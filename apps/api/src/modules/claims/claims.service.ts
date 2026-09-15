import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClaimStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { PrismaService } from '../../database/prisma.service';
import { Identity } from '../../common/types';
import { claimScope, requirePermission } from '../../common/policy';
import { audit } from '../../common/audit';
import { pagination, validate } from '../../common/validation';
import { auditDecisionInput, draftInput, fullWeekCoverage, hodDecisionInput, overloadHours, paymentCompleteInput, provcDecisionInput, submissionPolicy, totalHours, versionInput } from './claim-policy';

const json=(value:unknown):Prisma.InputJsonValue=>JSON.parse(JSON.stringify(value));
const listing=pagination.extend({status:z.nativeEnum(ClaimStatus).optional()});
const summary={id:true,reference:true,status:true,type:true,version:true,revision:true,totalHours:true,eligibleHours:true,createdAt:true,submittedAt:true,lecturerId:true,lecturer:{select:{name:true,staffId:true}},department:{select:{name:true}},semester:{select:{name:true,academicYear:{select:{name:true}}}}} satisfies Prisma.ClaimSelect;
const snapshotLabels=z.object({lecturer:z.object({name:z.string(),staffId:z.string()}),department:z.object({name:z.string()}),semester:z.object({name:z.string()}),academicYear:z.object({name:z.string()})});
function historicalLabels<T extends {lecturer:{name:string;staffId:string};department:{name:string};semester:{name:string;academicYear:{name:string}}}>(claim:T,value:Prisma.JsonValue|null):T {
  const snapshot=snapshotLabels.safeParse(value);if(!snapshot.success)return claim;
  return {...claim,lecturer:{...claim.lecturer,...snapshot.data.lecturer},department:{...claim.department,...snapshot.data.department},semester:{...claim.semester,...snapshot.data.semester,academicYear:{...claim.semester.academicYear,...snapshot.data.academicYear}}};
}
@Injectable()
export class ClaimsService {
  constructor(@Inject(PrismaService) private db:PrismaService){}
  async list(user:Identity,query:unknown){
    const p=validate(listing,query);const where:Prisma.ClaimWhereInput={AND:[claimScope(user),{...(p.status?{status:p.status}:{}),...(p.search?{OR:[{reference:{contains:p.search,mode:'insensitive'}},{lecturer:{name:{contains:p.search,mode:'insensitive'}}}]}:{})}]};
    const [data,total]=await Promise.all([this.db.claim.findMany({where,select:{...summary,calculation:true},orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(p.page-1)*p.pageSize,take:p.pageSize}),this.db.claim.count({where})]);
    return {data:data.map(({calculation,...claim})=>historicalLabels(claim,calculation)),meta:{page:p.page,pageSize:p.pageSize,total}};
  }
  async detail(user:Identity,id:string){
    const claim=await this.db.claim.findFirst({where:{AND:[{id},claimScope(user)]},select:{...summary,semesterId:true,departmentId:true,remarks:true,calculation:true,items:{include:{course:{select:{id:true,code:true,title:true}}},orderBy:{id:'asc'}},history:{orderBy:{sequence:'asc'}},revisions:{orderBy:{revision:'asc'}},approvals:{orderBy:{createdAt:'asc'}},payment:{include:{rate:true}}}});
    if(!claim)throw new NotFoundException('Claim not found.');
    const courses=z.object({courses:z.array(z.object({id:z.string(),code:z.string(),title:z.string()}))}).safeParse(claim.calculation);
    return {...historicalLabels(claim,claim.calculation),items:claim.items.map(item=>({...item,course:courses.success?(courses.data.courses.find(course=>course.id===item.courseId)??item.course):item.course}))};
  }
  private async validateDraft(tx:Prisma.TransactionClient,user:Identity,data:z.infer<typeof draftInput>){
    if(!user.departmentId)throw new UnprocessableEntityException('Your account needs a department before you can create claims.');
    if((data.type==='PART_TIME')!==(user.employmentType==='PART_TIME'))throw new UnprocessableEntityException('Claim type must match your employment classification.');
    const department=await tx.department.findFirst({where:{id:user.departmentId,active:true,faculty:{active:true}}});
    if(!department)throw new UnprocessableEntityException('Your department or faculty is inactive.');
    const semester=await tx.semester.findFirst({where:{id:data.semesterId,active:true,academicYear:{active:true}}});
    if(!semester)throw new UnprocessableEntityException('Select an active semester.');
    const ids=data.items.map(item=>item.courseId);
    if(new Set(ids).size!==ids.length)throw new UnprocessableEntityException('Each course can appear only once in this claim.');
    const courses=await tx.course.findMany({where:{id:{in:ids},active:true,departmentId:user.departmentId}});
    if(courses.length!==ids.length)throw new UnprocessableEntityException('Select active courses from your department.');
    for(const item of data.items){
      if(item.startsOn>item.endsOn||new Date(item.startsOn)<semester.startsOn||new Date(item.endsOn)>semester.endsOn)throw new UnprocessableEntityException('Teaching dates must be ordered and inside the semester.');
    }
    const total=totalHours(data.items);
    if(total.gt('99999999.9999'))throw new UnprocessableEntityException('Total hours exceed the supported range.');
    return {department,semester,courses,total};
  }
  private async replay(tx:Prisma.TransactionClient,user:Identity,operation:string,key:string,body:unknown){
    validate(z.string().uuid(),key);
    const requestHash=createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const prior=await tx.idempotencyRecord.findUnique({where:{actorId_operation_key:{actorId:user.id,operation,key}}});
    if(prior&&prior.requestHash!==requestHash)throw new ConflictException('This request key was already used for different data.');
    return {prior,requestHash};
  }
  async create(user:Identity,body:unknown,key:string){
    requirePermission(user,'claims.create');const data=validate(draftInput,body);
    return this.db.$transaction(async tx=>{
      const {prior,requestHash}=await this.replay(tx,user,'claims.create',key,data);if(prior)return prior.result;
      const {total}=await this.validateDraft(tx,user,data);
      const items=data.items.map(item=>({...item,startsOn:new Date(item.startsOn),endsOn:new Date(item.endsOn),totalHours:totalHours([item]).toString()})) as Prisma.ClaimItemUncheckedCreateWithoutClaimInput[];
      const claim=await tx.claim.create({data:{lecturerId:user.id,departmentId:user.departmentId!,semesterId:data.semesterId,type:data.type,remarks:data.remarks,reference:`UPSA-${new Date().getUTCFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`,totalHours:total.toString(),items:{create:items}}});
      await tx.claimHistory.create({data:{claimId:claim.id,revision:0,toStatus:'DRAFT',actorId:user.id,actorName:user.name,comment:'Draft created'}});
      await audit(tx,user,'CLAIM_CREATED','Claim',claim.id,{version:claim.version});
      const result={id:claim.id,version:claim.version,status:claim.status};
      await tx.idempotencyRecord.create({data:{actorId:user.id,operation:'claims.create',key,requestHash,result}});
      return result;
    },{isolationLevel:'Serializable'});
  }
  async update(user:Identity,id:string,body:unknown){
    requirePermission(user,'claims.edit_draft');const {expectedVersion,...data}=validate(draftInput.extend({expectedVersion:z.number().int().positive()}),body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,lecturerId:user.id}});if(!claim)throw new NotFoundException();
      if(!['DRAFT','RETURNED_FOR_CORRECTION'].includes(claim.status)||claim.version!==expectedVersion)throw new ConflictException('This claim changed or is no longer editable. Reload it before continuing.');
      if(claim.departmentId!==user.departmentId)throw new UnprocessableEntityException('Department transfers require an administrator to resolve claim routing.');
      const {total}=await this.validateDraft(tx,user,data);
      if(claim.revision>0&&(claim.semesterId!==data.semesterId||claim.type!==data.type))throw new UnprocessableEntityException('A returned claim must retain its semester and claim type.');
      const updated=await tx.claim.updateMany({where:{id,version:expectedVersion},data:{semesterId:data.semesterId,type:data.type,remarks:data.remarks,totalHours:total.toString(),eligibleHours:0,calculation:Prisma.DbNull,version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before continuing.');
      await tx.claimItem.deleteMany({where:{claimId:id}});
      await tx.claimItem.createMany({data:data.items.map(item=>({...item,claimId:id,startsOn:new Date(item.startsOn),endsOn:new Date(item.endsOn),totalHours:totalHours([item]).toString()})) as Prisma.ClaimItemCreateManyInput[]});
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:claim.status,toStatus:claim.status,actorId:user.id,actorName:user.name,comment:'Draft updated'}});
      await audit(tx,user,'CLAIM_UPDATED','Claim',id,{previousVersion:expectedVersion,version:expectedVersion+1});
      return {id,version:expectedVersion+1,status:claim.status};
    },{isolationLevel:'Serializable'});
  }
  async cancel(user:Identity,id:string,body:unknown){
    requirePermission(user,'claims.cancel_own');const {expectedVersion}=validate(versionInput,body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,lecturerId:user.id}});if(!claim)throw new NotFoundException();
      const changed=await tx.claim.updateMany({where:{id,lecturerId:user.id,status:'DRAFT',version:expectedVersion},data:{status:'CANCELLED',version:{increment:1}}});
      if(!changed.count)throw new ConflictException('Only an unchanged draft can be cancelled.');
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:'DRAFT',toStatus:'CANCELLED',actorId:user.id,actorName:user.name,comment:'Cancelled by lecturer'}});
      await audit(tx,user,'CLAIM_CANCELLED','Claim',id);
      return {id,status:'CANCELLED',version:expectedVersion+1};
    });
  }
  async submit(user:Identity,id:string,body:unknown,key:string){
    requirePermission(user,'claims.submit');const {expectedVersion}=validate(versionInput,body);
    return this.db.$transaction(async tx=>{
      const operation=`claims.submit:${id}`;const {prior,requestHash}=await this.replay(tx,user,operation,key,{expectedVersion});if(prior)return prior.result;
      const claim=await tx.claim.findFirst({where:{id,lecturerId:user.id},include:{items:true}});if(!claim)throw new NotFoundException();
      if(!['DRAFT','RETURNED_FOR_CORRECTION'].includes(claim.status)||claim.version!==expectedVersion)throw new ConflictException('This claim changed or has already been submitted.');
      if(claim.departmentId!==user.departmentId)throw new UnprocessableEntityException('Department transfers require an administrator to resolve claim routing.');
      const setting=await tx.systemSetting.findUnique({where:{key:'claim-submission-policy'}});
      const policy=submissionPolicy.safeParse(setting?.value);
      if(!setting||!policy.success)throw new UnprocessableEntityException('Submission is blocked until an administrator records the approved teaching and eligibility policy. Your draft is saved.');
      const data=validate(draftInput,{semesterId:claim.semesterId,type:claim.type,remarks:claim.remarks,items:claim.items.map(item=>({courseId:item.courseId,startsOn:item.startsOn.toISOString().slice(0,10),endsOn:item.endsOn.toISOString().slice(0,10),weeklyHours:item.weeklyHours.toString(),weeks:item.weeks,remarks:item.remarks}))});
      const verified=await this.validateDraft(tx,user,data);
      if(!data.items.length||data.items.some(item=>Number(item.weeklyHours)<=0||!fullWeekCoverage(item)))throw new UnprocessableEntityException('Submission requires positive hours and contiguous full teaching weeks matching the selected dates.');
      const workloads=await tx.workload.findMany({where:{lecturerId:user.id,semesterId:claim.semesterId}});
      const selected=workloads.filter(workload=>data.items.some(item=>item.courseId===workload.courseId));
      for(const item of data.items){
        const workload=selected.find(record=>record.courseId===item.courseId);
        if(!workload||workload.startsOn.toISOString().slice(0,10)!==item.startsOn||workload.endsOn.toISOString().slice(0,10)!==item.endsOn||workload.weeks!==item.weeks||!workload.weeklyHours.equals(item.weeklyHours))throw new UnprocessableEntityException('Teaching details must match verified workload assignments. Ask your administrator to review your assignments.');
      }
      let eligible=verified.total;let workloadRule:unknown=null;
      if(claim.type==='OVERLOAD'){
        const first=data.items[0];
        if(selected.length!==workloads.length||data.items.some(item=>item.startsOn!==first.startsOn||item.endsOn!==first.endsOn||item.weeks!==first.weeks))throw new UnprocessableEntityException('This overload policy requires every verified assignment in a single claim with a common teaching period.');
        const rules=await tx.workloadRule.findMany({where:{category:user.category,active:true,effectiveFrom:{lte:new Date(first.endsOn)},effectiveTo:{gte:new Date(first.startsOn)}}});
        if(rules.length!==1||rules[0].effectiveFrom>new Date(first.startsOn)||rules[0].effectiveTo<new Date(first.endsOn))throw new UnprocessableEntityException('One approved workload rule must cover the entire teaching period.');
        workloadRule=rules[0];eligible=overloadHours(data.items,rules[0].expectedWeeklyHours.toString());
      }
      if(eligible.lte(0))throw new UnprocessableEntityException('This claim has no eligible teaching hours under the configured policy.');
      const now=new Date();const reviewers=await tx.user.findMany({where:{active:true,id:{not:user.id},roles:{some:{role:{code:'HOD',permissions:{some:{permissionCode:'claims.approve_hod'}}}}},scopes:{some:{roleCode:'HOD',departmentId:claim.departmentId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}}},select:{id:true}});
      if(!reviewers.length)throw new UnprocessableEntityException('No active HOD reviewer is assigned to your department. Your draft is saved.');
      const revision=claim.revision+1;
      const snapshot=json({claim:{id,reference:claim.reference,semesterId:claim.semesterId,departmentId:claim.departmentId,remarks:claim.remarks,type:claim.type},lecturer:{id:user.id,name:user.name,staffId:user.staffId,employmentType:user.employmentType,category:user.category},department:verified.department,faculty:await tx.faculty.findUnique({where:{id:verified.department.facultyId}}),semester:verified.semester,academicYear:await tx.academicYear.findUniqueOrThrow({where:{id:verified.semester.academicYearId}}),courses:verified.courses,items:data.items,workloads:selected,workloadRule,policy:policy.data,policyVersion:setting.version,totalHours:verified.total.toString(),eligibleHours:eligible.toString(),calculationVersion:1});
      const updated=await tx.claim.updateMany({where:{id,version:expectedVersion},data:{status:'HOD_REVIEW',version:{increment:1},revision,submittedAt:now,totalHours:verified.total.toString(),eligibleHours:eligible.toString(),calculation:snapshot}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before submitting.');
      await tx.claimCoverage.deleteMany({where:{claimId:id}});
      await tx.claimCoverage.createMany({data:selected.map(workload=>({workloadId:workload.id,claimId:id,revision}))});
      await tx.claimRevision.create({data:{claimId:id,revision,snapshot}});
      await tx.claimHistory.createMany({data:[{claimId:id,revision,fromStatus:claim.status,toStatus:'SUBMITTED',actorId:user.id,actorName:user.name,comment:'Submitted for review'},{claimId:id,revision,fromStatus:'SUBMITTED',toStatus:'HOD_REVIEW',actorId:user.id,actorName:user.name,comment:'Routed to HOD review'}]});
      await audit(tx,user,'CLAIM_SUBMITTED','Claim',id,{revision,version:expectedVersion+1,eligibleHours:eligible.toString()});
      await tx.outboxEvent.create({data:{eventKey:`claim:${id}:revision:${revision}:submitted`,eventType:'CLAIM_SUBMITTED',aggregateId:id,payload:{recipientIds:reviewers.map(reviewer=>reviewer.id),title:'Claim awaiting HOD review',message:`${claim.reference} was submitted by ${user.name}.`}}});
      const result={id,status:'HOD_REVIEW',version:expectedVersion+1,revision};
      await tx.idempotencyRecord.create({data:{actorId:user.id,operation,key,requestHash,result}});
      return result;
    },{isolationLevel:'Serializable',timeout:15000});
  }
  async hodDecision(user:Identity,id:string,body:unknown){
    requirePermission(user,'claims.approve_hod');const {expectedVersion,decision,comment}=validate(hodDecisionInput,body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,departmentId:{in:user.scopes.filter(scope=>scope.roleCode==='HOD').map(scope=>scope.departmentId)}},include:{approvals:true}});
      if(!claim)throw new NotFoundException('Claim not found.');
      if(claim.status!=='HOD_REVIEW'||claim.version!==expectedVersion)throw new ConflictException('This claim changed or is no longer awaiting HOD review.');
      if(claim.lecturerId===user.id)throw new ConflictException('You cannot review your own claim.');
      if(claim.approvals.some(approval=>approval.revision===claim.revision&&approval.stage==='HOD'))throw new ConflictException('This revision already has a HOD decision.');
      if(decision==='RETURN'&&!user.permissions.includes('claims.return'))throw new UnprocessableEntityException('HOD reviewers can approve or reject claims.');
      const now=new Date();let nextStatus:ClaimStatus;let historyComment:string;
      if(decision==='APPROVE'){
        const reviewers=await tx.user.findMany({where:{active:true,id:{not:claim.lecturerId},roles:{some:{role:{code:'PRO_VC',permissions:{some:{permissionCode:'claims.approve_provc'}}}}},scopes:{some:{roleCode:'PRO_VC',departmentId:claim.departmentId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}}},select:{id:true}});
        if(!reviewers.length)throw new UnprocessableEntityException('No active Pro VC reviewer is assigned to this department.');
        nextStatus='PRO_VC_REVIEW';historyComment='HOD approved and routed for final review';
      } else if(decision==='RETURN'){nextStatus='RETURNED_FOR_CORRECTION';historyComment='Returned by HOD for correction';}
      else {nextStatus='HOD_REJECTED';historyComment='Rejected by HOD';}
      const updated=await tx.claim.updateMany({where:{id,status:'HOD_REVIEW',version:expectedVersion},data:{status:nextStatus,version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before deciding.');
      await tx.approval.create({data:{claimId:id,revision:claim.revision,reviewerId:user.id,stage:'HOD',decision,comment}});
      const history=[{claimId:id,revision:claim.revision,fromStatus:'HOD_REVIEW',toStatus:decision==='APPROVE'?'HOD_APPROVED':nextStatus,actorId:user.id,actorName:user.name,comment}];
      if(decision==='APPROVE')history.push({claimId:id,revision:claim.revision,fromStatus:'HOD_APPROVED',toStatus:'PRO_VC_REVIEW',actorId:user.id,actorName:user.name,comment:historyComment});
      await tx.claimHistory.createMany({data:history});
      await audit(tx,user,`CLAIM_HOD_${decision}`,'Claim',id,{revision:claim.revision,version:expectedVersion+1});
      if(decision==='APPROVE'){
        const recipients=await tx.user.findMany({where:{active:true,id:{not:claim.lecturerId},roles:{some:{role:{code:'PRO_VC',permissions:{some:{permissionCode:'claims.approve_provc'}}}}},scopes:{some:{roleCode:'PRO_VC',departmentId:claim.departmentId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}}},select:{id:true}});
        if(recipients.length)await tx.outboxEvent.create({data:{eventKey:`claim:${id}:revision:${claim.revision}:hod-approved`,eventType:'CLAIM_HOD_APPROVED',aggregateId:id,payload:{recipientIds:recipients.map(recipient=>recipient.id),title:'Claim approved by HOD',message:`${claim.reference} has been approved by the HOD and is ready for Pro VC final review.`}}});
      }
      return {id,status:nextStatus,version:expectedVersion+1,revision:claim.revision};
    },{isolationLevel:'Serializable'});
  }
  async provcDecision(user:Identity,id:string,body:unknown){
    requirePermission(user,'claims.approve_provc');const {expectedVersion,decision,comment}=validate(provcDecisionInput,body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,...(user.permissions.includes('claims.view_system')?{}:{departmentId:{in:user.scopes.filter(scope=>scope.roleCode==='PRO_VC').map(scope=>scope.departmentId)}})},include:{approvals:true}});
      if(!claim)throw new NotFoundException('Claim not found.');
      if(claim.status!=='PRO_VC_REVIEW'||claim.version!==expectedVersion)throw new ConflictException('This claim changed or is no longer awaiting final review.');
      if(claim.lecturerId===user.id)throw new ConflictException('You cannot review your own claim.');
      if(claim.approvals.some(approval=>approval.revision===claim.revision&&approval.stage==='PRO_VC'))throw new ConflictException('This revision already has a final decision.');
      const nextStatus:ClaimStatus=decision==='APPROVE'?'AUDIT_REVIEW':'PRO_VC_REJECTED';
      const updated=await tx.claim.updateMany({where:{id,status:'PRO_VC_REVIEW',version:expectedVersion},data:{status:nextStatus,version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before deciding.');
      await tx.approval.create({data:{claimId:id,revision:claim.revision,reviewerId:user.id,stage:'PRO_VC',decision,comment}});
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:'PRO_VC_REVIEW',toStatus:nextStatus,actorId:user.id,actorName:user.name,comment}});
      await audit(tx,user,`CLAIM_PROVC_${decision}`,'Claim',id,{revision:claim.revision,version:expectedVersion+1});
      if(decision==='APPROVE'){
        const now=new Date();
        const recipients=await tx.user.findMany({where:{active:true,roles:{some:{role:{code:'AUDITOR',permissions:{some:{permissionCode:'claims.audit'}}}}},scopes:{some:{roleCode:'AUDITOR',departmentId:claim.departmentId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}}},select:{id:true}});
        if(recipients.length)await tx.outboxEvent.create({data:{eventKey:`claim:${id}:revision:${claim.revision}:provc-approved`,eventType:'CLAIM_PROVC_APPROVED',aggregateId:id,payload:{recipientIds:recipients.map(recipient=>recipient.id),title:'Claim approved by VC',message:`${claim.reference} has been authorized by the VC and is ready for Internal Audit verification.`}}});
      }
      return {id,status:nextStatus,version:expectedVersion+1,revision:claim.revision};
    },{isolationLevel:'Serializable'});
  }
  async auditDecision(user:Identity,id:string,body:unknown){
    requirePermission(user,'claims.audit');const {expectedVersion,decision,reason,comment}=validate(auditDecisionInput,body);
    if(decision==='CLEAR')requirePermission(user,'claims.audit_clear');
    if(decision==='QUERY')requirePermission(user,'claims.audit_query');
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,departmentId:{in:user.scopes.filter(scope=>scope.roleCode==='AUDITOR').map(scope=>scope.departmentId)}},include:{approvals:true}});
      if(!claim)throw new NotFoundException('Claim not found.');
      if(claim.status!=='AUDIT_REVIEW'||claim.version!==expectedVersion)throw new ConflictException('This claim changed or is no longer awaiting audit review.');
      const nextStatus:ClaimStatus=decision==='CLEAR'?'AUDIT_CLEARED':decision==='QUERY'?'AUDIT_QUERY':'AUDIT_REJECTED';
      const updated=await tx.claim.updateMany({where:{id,status:'AUDIT_REVIEW',version:expectedVersion},data:{status:nextStatus,version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before auditing.');
      await tx.approval.create({data:{claimId:id,revision:claim.revision,reviewerId:user.id,stage:'AUDIT',decision,comment:`${reason}: ${comment}`}});
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:'AUDIT_REVIEW',toStatus:nextStatus,actorId:user.id,actorName:user.name,comment:`${reason}: ${comment}`}});
      await audit(tx,user,`CLAIM_AUDIT_${decision}`,'Claim',id,{revision:claim.revision,reason,version:expectedVersion+1});
      if(decision==='CLEAR'){
        const now=new Date();
        const recipients=await tx.user.findMany({where:{active:true,roles:{some:{role:{code:'FINANCE',permissions:{some:{permissionCode:'payments.process'}}}}},scopes:{some:{roleCode:'FINANCE',departmentId:claim.departmentId,validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}}},select:{id:true}});
        if(recipients.length)await tx.outboxEvent.create({data:{eventKey:`claim:${id}:revision:${claim.revision}:audit-cleared`,eventType:'CLAIM_AUDIT_CLEARED',aggregateId:id,payload:{recipientIds:recipients.map(recipient=>recipient.id),title:'Claim cleared by Audit',message:`${claim.reference} has been cleared by Internal Audit and is ready for payment processing.`}}});
      }
      return {id,status:nextStatus,version:expectedVersion+1,revision:claim.revision};
    },{isolationLevel:'Serializable'});
  }
  async startFinance(user:Identity,id:string,body:unknown){
    requirePermission(user,'payments.process');const {expectedVersion}=validate(versionInput,body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,departmentId:{in:user.scopes.filter(scope=>scope.roleCode==='FINANCE').map(scope=>scope.departmentId)}}});
      if(!claim)throw new NotFoundException('Claim not found.');
      if(claim.status!=='AUDIT_CLEARED'||claim.version!==expectedVersion)throw new ConflictException('This claim changed or is not ready for finance processing.');
      const updated=await tx.claim.updateMany({where:{id,status:'AUDIT_CLEARED',version:expectedVersion},data:{status:'FINANCE_PROCESSING',version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before processing.');
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:'AUDIT_CLEARED',toStatus:'FINANCE_PROCESSING',actorId:user.id,actorName:user.name,comment:'Finance processing started'}});
      await audit(tx,user,'CLAIM_FINANCE_STARTED','Claim',id,{revision:claim.revision,version:expectedVersion+1});
      return {id,status:'FINANCE_PROCESSING',version:expectedVersion+1,revision:claim.revision};
    },{isolationLevel:'Serializable'});
  }
  async markPaymentPending(user:Identity,id:string,body:unknown){
    requirePermission(user,'payments.process');const {expectedVersion}=validate(versionInput,body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,departmentId:{in:user.scopes.filter(scope=>scope.roleCode==='FINANCE').map(scope=>scope.departmentId)}},include:{payment:true}});
      if(!claim)throw new NotFoundException('Claim not found.');
      if(claim.status!=='FINANCE_PROCESSING'||claim.version!==expectedVersion)throw new ConflictException('This claim changed or is not in finance processing.');
      if(claim.payment)throw new ConflictException('This claim already has a payment record.');
      const snapshot=z.object({lecturer:z.object({category:z.string(),employmentType:z.string()})}).safeParse(claim.calculation);
      if(!snapshot.success)throw new UnprocessableEntityException('Submitted claim snapshot is missing payment classification evidence.');
      const rates=await tx.paymentRate.findMany({where:{active:true,semesterId:claim.semesterId,category:snapshot.data.lecturer.category,employmentType:snapshot.data.lecturer.employmentType}});
      if(rates.length!==1)throw new UnprocessableEntityException('Exactly one active payment rate must be configured for this claim category, employment type, and semester.');
      const rate=rates[0];const amount=new Decimal(claim.eligibleHours.toString()).times(rate.rate.toString()).toDecimalPlaces(rate.roundingPlaces).toFixed(4);
      const calculation=json({eligibleHours:claim.eligibleHours.toString(),rate:rate.rate.toString(),currency:rate.currency,roundingPlaces:rate.roundingPlaces,rateId:rate.id,calculationVersion:1});
      const updated=await tx.claim.updateMany({where:{id,status:'FINANCE_PROCESSING',version:expectedVersion},data:{status:'PAYMENT_PENDING',version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before creating payment.');
      const payment=await tx.payment.create({data:{claimId:id,rateId:rate.id,amount,currency:rate.currency,calculation,status:'PENDING'}});
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:'FINANCE_PROCESSING',toStatus:'PAYMENT_PENDING',actorId:user.id,actorName:user.name,comment:`Payment calculated in ${rate.currency}`}});
      await audit(tx,user,'PAYMENT_PENDING','Payment',payment.id,{claimId:id,amount,currency:rate.currency,version:expectedVersion+1});
      return {id,status:'PAYMENT_PENDING',version:expectedVersion+1,payment:{id:payment.id,version:payment.version,amount:payment.amount.toString(),currency:payment.currency}};
    },{isolationLevel:'Serializable'});
  }
  async completePayment(user:Identity,id:string,body:unknown){
    requirePermission(user,'payments.process');const data=validate(paymentCompleteInput,body);
    return this.db.$transaction(async tx=>{
      const claim=await tx.claim.findFirst({where:{id,departmentId:{in:user.scopes.filter(scope=>scope.roleCode==='FINANCE').map(scope=>scope.departmentId)}},include:{payment:true}});
      if(!claim)throw new NotFoundException('Claim not found.');
      if(claim.status!=='PAYMENT_PENDING'||claim.version!==data.expectedVersion||!claim.payment)throw new ConflictException('This claim changed or has no pending payment.');
      if(claim.payment.version!==data.paymentVersion||claim.payment.status!=='PENDING')throw new ConflictException('This payment changed. Reload it before completing payment.');
      const updated=await tx.claim.updateMany({where:{id,status:'PAYMENT_PENDING',version:data.expectedVersion},data:{status:'PAID',version:{increment:1}}});
      if(!updated.count)throw new ConflictException('This claim changed. Reload it before completing payment.');
      const payment=await tx.payment.update({where:{id:claim.payment.id},data:{status:'PAID',reference:data.reference,paidOn:new Date(data.paidOn),notes:data.notes,version:{increment:1}}});
      await tx.claimHistory.create({data:{claimId:id,revision:claim.revision,fromStatus:'PAYMENT_PENDING',toStatus:'PAID',actorId:user.id,actorName:user.name,comment:'Payment recorded as completed'}});
      await audit(tx,user,'PAYMENT_COMPLETED','Payment',payment.id,{claimId:id,reference:data.reference,paidOn:data.paidOn,version:data.expectedVersion+1});
      await tx.outboxEvent.create({data:{eventKey:`claim:${id}:revision:${claim.revision}:payment-completed`,eventType:'PAYMENT_COMPLETED',aggregateId:id,payload:{recipientIds:[claim.lecturerId],title:'Payment successful',message:`${claim.reference} has been processed successfully.`}}});
      return {id,status:'PAID',version:data.expectedVersion+1,payment:{id:payment.id,version:payment.version,status:payment.status,reference:payment.reference,paidOn:payment.paidOn}};
    },{isolationLevel:'Serializable'});
  }
}
