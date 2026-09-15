import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { rolePermissions } from '../src/common/policy';
import { newPassword, validate } from '../src/common/validation';
const db=new PrismaClient();
async function main(){
  if(process.env.NODE_ENV==='production')throw new Error('Development seeds are disabled in production.');
  if(!process.env.SEED_PASSWORD||process.env.SEED_PASSWORD.length<12)throw new Error('Set a strong SEED_PASSWORD.');
  validate(newPassword,process.env.SEED_PASSWORD);
  const passwordHash=await hash(process.env.SEED_PASSWORD,12);
  for(const code of new Set(Object.values(rolePermissions).flat()))await db.permission.upsert({where:{code},create:{code},update:{}});
  for(const [code,permissions] of Object.entries(rolePermissions)){
    const role=await db.role.upsert({where:{code},create:{code,name:{LECTURER:'Lecturer',HOD:'Head of Department',PRO_VC:'Pro Vice-Chancellor',FINANCE:'Finance Officer',AUDITOR:'Auditor',ADMIN:'Administrator'}[code]!},update:{}});
    for(const permissionCode of permissions)await db.rolePermission.upsert({where:{roleId_permissionCode:{roleId:role.id,permissionCode}},create:{roleId:role.id,permissionCode},update:{}});
  }
  const faculty=await db.faculty.upsert({where:{code:'DEMO-FAM'},create:{code:'DEMO-FAM',name:'Faculty of Accounting and Finance'},update:{}});
  const department=await db.department.upsert({where:{code:'DEMO-ACC'},create:{code:'DEMO-ACC',name:'Department of Accounting',facultyId:faculty.id},update:{}});
  const other=await db.department.upsert({where:{code:'DEMO-FIN'},create:{code:'DEMO-FIN',name:'Department of Banking and Finance',facultyId:faculty.id},update:{}});
  const year=await db.academicYear.upsert({where:{name:'2026/2027'},create:{name:'2026/2027',startsOn:new Date('2026-08-01'),endsOn:new Date('2027-07-31')},update:{}});
  const semester=await db.semester.upsert({where:{academicYearId_name:{academicYearId:year.id,name:'First Semester'}},create:{name:'First Semester',academicYearId:year.id,startsOn:new Date('2026-09-01'),endsOn:new Date('2026-12-31')},update:{}});
  const titles=['Financial Accounting','Management Accounting','Corporate Reporting','Auditing and Assurance','Taxation','Public Sector Accounting','Accounting Information Systems','Financial Management'];
  const courses=[];for(const [i,title] of titles.entries())courses.push(await db.course.upsert({where:{code:`DEMO-ACC${201+i}`},create:{code:`DEMO-ACC${201+i}`,title,departmentId:department.id},update:{}}));
  const names:Record<string,string>={LECTURER:'Dr. Ama Mensah',HOD:'Dr. Kwame Asante',PRO_VC:'Prof. Esi Owusu',FINANCE:'Akosua Boateng',AUDITOR:'Kofi Adjei',ADMIN:'Portal Administrator'};
  const users:Record<string,{id:string}>={};
  for(const [code,name] of Object.entries(names)){
    const email=`${code==='PRO_VC'?'provc':code==='LECTURER'?'lecturer':code==='AUDITOR'?'auditor':code.toLowerCase()}@example.test`;
    const user=await db.user.upsert({where:{email},create:{email,name,staffId:`DEMO-${code}`,passwordHash,departmentId:department.id,title:code==='LECTURER'?'Lecturer':name.startsWith('Prof.')?'Pro Vice-Chancellor':code.replace('_',' ')},update:{}});
    users[code]=user;
    const role=await db.role.findUniqueOrThrow({where:{code}});
    await db.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:role.id}},create:{userId:user.id,roleId:role.id},update:{}});
    if(['HOD','PRO_VC','FINANCE','AUDITOR'].includes(code))await db.scopeGrant.upsert({where:{userId_roleCode_departmentId:{userId:user.id,roleCode:code,departmentId:department.id}},create:{userId:user.id,roleCode:code,departmentId:department.id},update:{}});
  }
  await db.systemSetting.upsert({where:{key:'claim-submission-policy'},create:{key:'claim-submission-policy',value:{approvalReference:'UPSA teaching claims policy 2026',calendar:'CONTIGUOUS_FULL_WEEKS',eligibility:'VERIFIED_ASSIGNMENTS',overloadAllocation:'FULL_WORKLOAD_SINGLE_CLAIM',routing:'HOME_DEPARTMENT',coverage:'SINGLE_ASSIGNMENT_PER_COURSE'}},update:{}});
  const assignment={lecturerId:users.LECTURER.id,semesterId:semester.id,courseId:courses[0].id};
  await db.workload.upsert({where:{lecturerId_semesterId_courseId:assignment},create:{...assignment,weeklyHours:4,weeks:16,startsOn:new Date('2026-09-01'),endsOn:new Date('2026-12-21')},update:{weeklyHours:4,weeks:16,startsOn:new Date('2026-09-01'),endsOn:new Date('2026-12-21')}});
  const existingRate=await db.paymentRate.findFirst({where:{semesterId:semester.id,category:'LECTURER',employmentType:'PART_TIME',active:true}});
  if(!existingRate)await db.paymentRate.create({data:{semesterId:semester.id,category:'LECTURER',employmentType:'PART_TIME',rate:120,currency:'GHS',roundingPlaces:2}});
  const second=await db.user.upsert({where:{email:'other-lecturer@example.test'},create:{email:'other-lecturer@example.test',staffId:'DEMO-OTHER',name:'Dr. Kojo Addo',passwordHash,departmentId:other.id},update:{}});
  const lecturerRole=await db.role.findUniqueOrThrow({where:{code:'LECTURER'}});await db.userRole.upsert({where:{userId_roleId:{userId:second.id,roleId:lecturerRole.id}},create:{userId:second.id,roleId:lecturerRole.id},update:{}});
  console.log('Development accounts, approved claim policy, a verified lecturer workload, and a demonstration payment rate created.');
}
main().finally(()=>db.$disconnect());
