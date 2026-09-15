import { Inject, Injectable, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Identity } from '../../common/types';
import { requirePermission, rolePermissions } from '../../common/policy';
import { audit } from '../../common/audit';
import { validate, uuid, date, decimal, newPassword } from '../../common/validation';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { tokenHash } from '../auth/auth.service';
import { submissionPolicy } from '../claims/claim-policy';
import { webOrigin } from '../../common/runtime';
import { Prisma } from '@prisma/client';
const definitions:Record<string,{model:string;permission:string;schema:z.ZodTypeAny;include?:object}>={
  faculties:{model:'faculty',permission:'faculties.manage',schema:z.object({code:z.string().min(2).max(20),name:z.string().min(3).max(150),active:z.boolean().default(true)}).strict()},
  departments:{model:'department',permission:'departments.manage',schema:z.object({code:z.string().min(2).max(20),name:z.string().min(3).max(150),facultyId:uuid,active:z.boolean().default(true)}).strict(),include:{faculty:true}},
  courses:{model:'course',permission:'courses.manage',schema:z.object({code:z.string().min(2).max(30),title:z.string().min(3).max(150),departmentId:uuid,creditHours:z.number().int().min(0).max(30),active:z.boolean().default(true)}).strict(),include:{department:true}},
  'academic-years':{model:'academicYear',permission:'academic_periods.manage',schema:z.object({name:z.string().min(4).max(30),startsOn:date,endsOn:date,active:z.boolean().default(true)}).strict()},
  semesters:{model:'semester',permission:'academic_periods.manage',schema:z.object({name:z.string().min(3).max(50),academicYearId:uuid,startsOn:date,endsOn:date,active:z.boolean().default(true)}).strict(),include:{academicYear:true}},
  'workload-rules':{model:'workloadRule',permission:'workloads.manage',schema:z.object({category:z.string().min(2).max(40),expectedWeeklyHours:decimal,effectiveFrom:date,effectiveTo:date,active:z.boolean().default(true)}).strict()},
  'lecturer-workloads':{model:'workload',permission:'workloads.manage',schema:z.object({lecturerId:uuid,semesterId:uuid,courseId:uuid,weeklyHours:decimal,weeks:z.number().int().min(1).max(53),startsOn:date,endsOn:date}).strict(),include:{lecturer:{select:{id:true,name:true}},course:true,semester:true}},
  'payment-rates':{model:'paymentRate',permission:'rates.manage',schema:z.object({category:z.string().min(2).max(40),employmentType:z.enum(['PART_TIME','FULL_TIME']),semesterId:uuid,rate:decimal.refine(v=>Number(v)>0,'Rate must be positive.'),currency:z.string().regex(/^[A-Z]{3}$/),roundingPlaces:z.number().int().min(0).max(4),active:z.boolean().default(true)}).strict(),include:{semester:true}},
};
const userInput=z.object({name:z.string().trim().min(3).max(100),email:z.string().email().transform(v=>v.toLowerCase()),staffId:z.string().trim().min(3).max(30),title:z.string().max(80),departmentId:uuid.nullable(),employmentType:z.enum(['PART_TIME','FULL_TIME']),category:z.string().min(2).max(40),active:z.boolean(),password:newPassword.optional()}).strict();
const importUserInput=userInput.extend({roles:z.array(z.enum(['LECTURER','HOD','PRO_VC','FINANCE','AUDITOR','ADMIN'])).min(1).max(6).default(['LECTURER'])});
const scopedRoleCodes=new Set(['HOD','PRO_VC','FINANCE','AUDITOR']);
@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private db:PrismaService){}
  async catalog(user:Identity) {
    const [faculties,departments,courses,semesters]=await Promise.all([this.db.faculty.findMany({where:{active:true}}),this.db.department.findMany({where:{active:true},include:{faculty:true}}),this.db.course.findMany({where:{active:true,...(user.permissions.includes('claims.create')&&!user.permissions.includes('courses.manage')?{departmentId:user.departmentId??'00000000-0000-0000-0000-000000000000'}:{})},orderBy:{code:'asc'}}),this.db.semester.findMany({include:{academicYear:true},orderBy:{startsOn:'desc'}})]);
    const academicYears=await this.db.academicYear.findMany({where:{active:true},orderBy:{startsOn:'desc'}});
    const lecturers=user.permissions.includes('workloads.manage')?await this.db.user.findMany({where:{active:true,roles:{some:{role:{code:'LECTURER'}}}},select:{id:true,name:true,staffId:true},orderBy:{name:'asc'}}):[];
    const workloads=user.permissions.includes('claims.create')?await this.db.workload.findMany({where:{lecturerId:user.id,semester:{active:true}},select:{courseId:true,semesterId:true,weeklyHours:true,weeks:true,startsOn:true,endsOn:true},orderBy:{startsOn:'asc'}}):[];
    return {faculties,departments,courses,semesters,academicYears,workloads:workloads.map(workload=>({...workload,weeklyHours:workload.weeklyHours.toString(),startsOn:workload.startsOn.toISOString(),endsOn:workload.endsOn.toISOString()})),lecturers:lecturers.map(lecturer=>({id:lecturer.id,name:`${lecturer.name} (${lecturer.staffId})`})),teachingSemesters:semesters.map(semester=>({id:semester.id,name:`${semester.academicYear.name} / ${semester.name}`})),teachingCourses:courses.map(course=>({id:course.id,name:`${course.code} - ${course.title}`}))};
  }
  async list(user:Identity,resource:string,page:number,pageSize:number,search:string) {
    const def=definitions[resource];if(!def) throw new UnprocessableEntityException('Unknown configuration resource.');requirePermission(user,def.permission);
    const field=['courses'].includes(resource)?'title':['workload-rules','payment-rates'].includes(resource)?'category':resource==='lecturer-workloads'?null:'name';
    const where=search&&field?{[field]:{contains:search,mode:'insensitive'}}:search&&resource==='lecturer-workloads'?{lecturer:{name:{contains:search,mode:'insensitive'}}}:{};
    const model=(this.db as any)[def.model];
    const [data,total]=await Promise.all([model.findMany({where,include:def.include,skip:(page-1)*pageSize,take:pageSize,orderBy:{id:'asc'}}),model.count({where})]);return {data,meta:{page,pageSize,total}};
  }
  async save(user:Identity,resource:string,body:unknown,id?:string) {
    const def=definitions[resource];if(!def) throw new UnprocessableEntityException('Unknown configuration resource.');requirePermission(user,def.permission);
    const data=validate(def.schema,body) as any;
    for(const key of ['startsOn','endsOn','effectiveFrom','effectiveTo']) if(data[key]) data[key]=new Date(data[key]);
    if(data.startsOn>data.endsOn || data.effectiveFrom>data.effectiveTo) throw new UnprocessableEntityException('The end date must follow the start date.');
    return this.db.$transaction(async tx=>{
      const model=(tx as any)[def.model];
      const before=id?await model.findUniqueOrThrow({where:{id}}):null;
      if(resource==='lecturer-workloads') {
        if(id&&await tx.claimCoverage.count({where:{workloadId:id}}))throw new ConflictException('Submitted workload evidence cannot be changed.');
        const lecturer=await tx.user.findUniqueOrThrow({where:{id:data.lecturerId}});
        const course=await tx.course.findUniqueOrThrow({where:{id:data.courseId}});
        const semester=await tx.semester.findUniqueOrThrow({where:{id:data.semesterId}});
        if(!lecturer.active||!course.active||course.departmentId!==lecturer.departmentId||!semester.active||data.startsOn<semester.startsOn||data.endsOn>semester.endsOn||Number(data.weeklyHours)<=0||Number(data.weeklyHours)>168)throw new UnprocessableEntityException('Workload requires active matching lecturer/course records, positive weekly hours up to 168, and dates within the semester.');
      }
      if(id&&['payment-rates','workload-rules'].includes(resource)) {
        const compared=Object.keys(data).filter(k=>k!=='active').some(k=>String(data[k])!==String(before[k]));
        if(compared) throw new ConflictException('Create a new rule version and deactivate the old version to preserve history.');
      }
      if(resource==='semesters') {const year=await tx.academicYear.findUniqueOrThrow({where:{id:data.academicYearId}});if(data.startsOn<year.startsOn||data.endsOn>year.endsOn)throw new UnprocessableEntityException('Semester dates must be inside the academic year.');}
      if(resource==='academic-years'&&id&&await tx.semester.count({where:{academicYearId:id,OR:[{startsOn:{lt:data.startsOn}},{endsOn:{gt:data.endsOn}}]}}))throw new UnprocessableEntityException('Existing semesters must remain inside the academic year.');
      if(resource==='workload-rules'&&data.active&&await tx.workloadRule.count({where:{id:id?{not:id}:undefined,category:data.category,active:true,effectiveFrom:{lte:data.effectiveTo},effectiveTo:{gte:data.effectiveFrom}}}))throw new ConflictException('An active workload rule overlaps this period.');
      if(resource==='payment-rates'&&data.active) {
        const overlap=await tx.paymentRate.count({where:{id:id?{not:id}:undefined,category:data.category,employmentType:data.employmentType,semesterId:data.semesterId,active:true}});
        if(overlap)throw new ConflictException('An active rate already covers this category and semester. Deactivate it first.');
      }
      const result=id?await model.update({where:{id},data}):await model.create({data});
      await audit(tx,user,id?'CONFIGURATION_UPDATED':'CONFIGURATION_CREATED',resource,result.id,{before,after:result});return result;
    },{isolationLevel:'Serializable'});
  }
  async users(user:Identity,page:number,pageSize:number,search:string) {
    requirePermission(user,'users.manage');const where={OR:[{name:{contains:search,mode:'insensitive' as const}},{email:{contains:search,mode:'insensitive' as const}},{staffId:{contains:search,mode:'insensitive' as const}}]};
    const [data,total]=await Promise.all([this.db.user.findMany({where,select:{id:true,name:true,email:true,staffId:true,title:true,employmentType:true,category:true,active:true,departmentId:true,department:{select:{name:true}},roles:{select:{role:{select:{code:true,name:true}}}},scopes:{select:{roleCode:true,departmentId:true,validFrom:true,validTo:true}}},orderBy:[{name:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize}),this.db.user.count({where})]);return {data,meta:{page,pageSize,total}};
  }
  async saveUser(user:Identity,body:unknown,id?:string) {
    requirePermission(user,'users.manage');
    const data=validate(userInput,body);
    const {password,...fields}=data;if(!id&&!password)throw new UnprocessableEntityException('Provide an initial password of at least 12 characters.');
    if(id===user.id&&!data.active)throw new ConflictException('You cannot deactivate your own account.');
    const passwordHash=password?await hash(password,12):undefined;
    return this.db.$transaction(async tx=>{
      const before=id?await tx.user.findUniqueOrThrow({where:{id}}):null;
      if(id&&!data.active) {const admins=await tx.user.count({where:{active:true,roles:{some:{role:{code:'ADMIN'}}}}});const targetAdmin=await tx.userRole.count({where:{userId:id,role:{code:'ADMIN'}}});if(targetAdmin&&admins<=1)throw new ConflictException('Keep at least one active administrator.');}
      const saved=id?await tx.user.update({where:{id},data:{...fields,...(passwordHash?{passwordHash}:{})}}):await tx.user.create({data:{...fields,passwordHash:passwordHash!} as Prisma.UserUncheckedCreateInput});
      if(!id) {
        const lecturerRole=await tx.role.findUniqueOrThrow({where:{code:'LECTURER'}});
        await tx.userRole.create({data:{userId:saved.id,roleId:lecturerRole.id}});
      }
      if(id&&(!data.active||passwordHash))await tx.session.updateMany({where:{userId:id},data:{revokedAt:new Date()}}); 
      await audit(tx,user,id?'USER_UPDATED':'USER_CREATED','User',saved.id,{before:before?{name:before.name,email:before.email,active:before.active}:null,after:fields});return {id:saved.id,name:saved.name};
    },{isolationLevel:'Serializable'});
  }
  async importUsers(user:Identity,body:unknown) {
    requirePermission(user,'users.manage');
    const data=validate(z.object({defaultPassword:newPassword.optional(),users:z.array(importUserInput).min(1).max(500)}).strict(),body);
    const withoutPassword=data.users.filter(row=>!row.password);if(withoutPassword.length&&!data.defaultPassword)throw new UnprocessableEntityException('Provide a default password or a password column for every imported user.');
    const canAssignRoles=user.permissions.includes('roles.manage');
    const emails=new Set<string>();const staffIds=new Set<string>();
    for(const row of data.users){
      if(!canAssignRoles&&row.roles.some(role=>role!=='LECTURER'))throw new UnprocessableEntityException('Only administrators can import users with administrative, finance, HOD, auditor, or Pro VC roles.');
      if(row.roles.some(role=>scopedRoleCodes.has(role))&&!row.departmentId)throw new UnprocessableEntityException(`Department is required for scoped roles on ${row.email}.`);
      if(emails.has(row.email)||staffIds.has(row.staffId))throw new ConflictException(`Duplicate email or staff ID in import: ${row.email} / ${row.staffId}`);
      emails.add(row.email);staffIds.add(row.staffId);
    }
    return this.db.$transaction(async tx=>{
      if(await tx.user.count({where:{OR:[{email:{in:[...emails]}},{staffId:{in:[...staffIds]}}]}}))throw new ConflictException('One or more imported emails or staff IDs already exist.');
      const roles=await tx.role.findMany({where:{code:{in:[...new Set(data.users.flatMap(row=>row.roles))]}}});
      const roleByCode=new Map(roles.map(role=>[role.code,role.id]));
      const created=[] as {id:string;email:string;staffId:string}[];
      for(const row of data.users){
        const {password,roles,...fields}=row;const passwordHash=await hash(password??data.defaultPassword!,12);
        const saved=await tx.user.create({data:{...fields,passwordHash}});
        const roleAssignments=roles.map(code=>{const roleId=roleByCode.get(code);if(!roleId)throw new UnprocessableEntityException(`Unknown role in import: ${code}`);return {userId:saved.id,roleId};});
        await tx.userRole.createMany({data:roleAssignments});
        const scopedRoles=roles.filter(code=>scopedRoleCodes.has(code));
        if(fields.departmentId&&scopedRoles.length)await tx.scopeGrant.createMany({data:scopedRoles.map(roleCode=>({userId:saved.id,roleCode,departmentId:fields.departmentId!})),skipDuplicates:true});
        created.push({id:saved.id,email:saved.email,staffId:saved.staffId});
      }
      await audit(tx,user,'USERS_IMPORTED','User',null,{count:created.length});
      return {created:created.length,users:created};
    },{isolationLevel:'Serializable',timeout:30000});
  }
  async roles(user:Identity) {requirePermission(user,'roles.manage');return this.db.role.findMany({include:{permissions:true},orderBy:{code:'asc'}});}
  async claimPolicy(user:Identity){requirePermission(user,'settings.manage');return this.db.systemSetting.findUnique({where:{key:'claim-submission-policy'}});}
  async saveClaimPolicy(user:Identity,body:unknown){
    requirePermission(user,'settings.manage');const data=validate(z.object({expectedVersion:z.number().int().min(0),policy:submissionPolicy}).strict(),body);
    return this.db.$transaction(async tx=>{
      const before=await tx.systemSetting.findUnique({where:{key:'claim-submission-policy'}});
      if((before?.version??0)!==data.expectedVersion)throw new ConflictException('The policy changed. Reload before saving.');
      if(before){const result=await tx.systemSetting.updateMany({where:{key:before.key,version:data.expectedVersion},data:{value:data.policy,version:{increment:1}}});if(!result.count)throw new ConflictException('The policy changed.');}
      else await tx.systemSetting.create({data:{key:'claim-submission-policy',value:data.policy}});
      await audit(tx,user,'CLAIM_POLICY_CONFIGURED','SystemSetting','claim-submission-policy',{before,after:data.policy});
      return tx.systemSetting.findUniqueOrThrow({where:{key:'claim-submission-policy'}});
    },{isolationLevel:'Serializable'});
  }
  async assignRoles(user:Identity,id:string,body:unknown) {
    requirePermission(user,'roles.manage');const data=validate(z.object({roles:z.array(z.enum(['LECTURER','HOD','PRO_VC','FINANCE','AUDITOR','ADMIN'])).min(1).max(6),scopes:z.array(z.object({roleCode:z.enum(['HOD','PRO_VC','FINANCE','AUDITOR']),departmentId:uuid,validFrom:z.string().datetime().optional(),validTo:z.string().datetime().nullable().optional()}).strict()).max(100)}).strict(),body);
    if(id===user.id)throw new ConflictException('Another administrator must change your roles.');
    for(const scope of data.scopes)if(!data.roles.includes(scope.roleCode as any))throw new UnprocessableEntityException('A scope must belong to an assigned role.');
    for(const scope of data.scopes)if(scope.validTo&&new Date(scope.validTo)<=new Date(scope.validFrom??Date.now()))throw new UnprocessableEntityException('Scope expiry must follow its start.');
    return this.db.$transaction(async tx=>{
      const previous=await tx.userRole.findMany({where:{userId:id},include:{role:true}});
      if(previous.some(r=>r.role.code==='ADMIN')&&!data.roles.includes('ADMIN')&&await tx.user.count({where:{active:true,roles:{some:{role:{code:'ADMIN'}}}}})<=1)throw new ConflictException('Keep at least one active administrator.');
      const roles=await tx.role.findMany({where:{code:{in:data.roles}}});
      await tx.userRole.deleteMany({where:{userId:id}});await tx.scopeGrant.deleteMany({where:{userId:id}});
      await tx.userRole.createMany({data:roles.map(role=>({userId:id,roleId:role.id}))});
      await tx.scopeGrant.createMany({data:data.scopes.map(scope=>({...scope,userId:id,validFrom:scope.validFrom?new Date(scope.validFrom):new Date(),validTo:scope.validTo?new Date(scope.validTo):null})),skipDuplicates:true});
      await tx.session.updateMany({where:{userId:id},data:{revokedAt:new Date()}});
      await audit(tx,user,'ROLES_ASSIGNED','User',id,{before:previous.map(r=>r.role.code),after:data});return {ok:true};
    },{isolationLevel:'Serializable'});
  }
  async rolePermissions(user:Identity,id:string,body:unknown) {
    requirePermission(user,'roles.manage');const {permissions}=validate(z.object({permissions:z.array(z.string())}).strict(),body);
    const catalog=new Set(Object.values(rolePermissions).flat());if(permissions.some(p=>!catalog.has(p)))throw new UnprocessableEntityException('Unknown permission.');
    const role=await this.db.role.findUniqueOrThrow({where:{id}});if(role.code==='ADMIN'&&['roles.manage','users.manage'].some(p=>!permissions.includes(p)))throw new ConflictException('Administrative recovery permissions must be retained.');
    if(permissions.some(permission=>!rolePermissions[role.code]?.includes(permission)))throw new UnprocessableEntityException('This permission is outside the allowed grants for this role.');
    return this.db.$transaction(async tx=>{await tx.rolePermission.deleteMany({where:{roleId:id}});await tx.rolePermission.createMany({data:[...new Set(permissions)].map(permissionCode=>({roleId:id,permissionCode}))});await audit(tx,user,'ROLE_PERMISSIONS_UPDATED','Role',id,{permissions});return {ok:true};});
  }
  async resetAccess(user:Identity,id:string) {requirePermission(user,'users.manage');const token=randomBytes(40).toString('base64url');await this.db.$transaction(async tx=>{await tx.resetToken.updateMany({where:{userId:id,consumedAt:null},data:{consumedAt:new Date()}});await tx.resetToken.create({data:{userId:id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+1800000)}});await tx.session.updateMany({where:{userId:id},data:{revokedAt:new Date()}});await audit(tx,user,'ACCESS_RESET_ISSUED','User',id);});return {resetUrl:`${webOrigin()}/reset-password?token=${token}`,expiresInMinutes:30};}
}
