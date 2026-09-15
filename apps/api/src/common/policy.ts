import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Identity } from './types';
export const rolePermissions:Record<string,string[]> = {
  LECTURER:['claims.create','claims.view_own','claims.edit_draft','claims.submit','claims.cancel_own','payments.view_own','reports.view_own','reports.export'],
  HOD:['claims.view_department','claims.approve_hod','claims.reject','reports.view_department','reports.export'],
  PRO_VC:['claims.view_provc_scope','claims.approve_provc','claims.reject','users.manage','notifications.broadcast','reports.view_department','reports.export'],
  FINANCE:['claims.view_finance','payments.view','payments.process','reports.view_finance','reports.export'],
  AUDITOR:['claims.view_audit','claims.audit','claims.audit_query','claims.audit_clear','audit.view','reports.view_audit','payments.view','reports.export'],
  ADMIN:['claims.view_system','claims.approve_provc','claims.reject','users.manage','roles.manage','faculties.manage','departments.manage','courses.manage','academic_periods.manage','workloads.manage','rates.manage','settings.manage','notifications.broadcast','audit.view','reports.view_system','reports.export'],
};
export function requirePermission(user:Identity,permission:string) { if(!user.permissions.includes(permission)) throw new ForbiddenException('You do not have permission to perform this action.'); }
export function departments(user:Identity,role:string) { return user.scopes.filter(s=>s.roleCode===role).map(s=>s.departmentId); }
export function claimScope(user:Identity):Prisma.ClaimWhereInput {
  const OR:Prisma.ClaimWhereInput[]=[];
  if(user.permissions.includes('claims.view_own')) OR.push({lecturerId:user.id});
  if(user.permissions.includes('claims.view_department')) OR.push({departmentId:{in:departments(user,'HOD')},status:{notIn:['DRAFT','CANCELLED']}});
  if(user.permissions.includes('claims.view_provc_scope')) OR.push({departmentId:{in:departments(user,'PRO_VC')},status:{in:['PRO_VC_REVIEW','PRO_VC_REJECTED','PRO_VC_APPROVED','AUDIT_REVIEW','AUDIT_CLEARED','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}});
  if(user.permissions.includes('claims.view_finance')) OR.push({departmentId:{in:departments(user,'FINANCE')},status:{in:['AUDIT_CLEARED','AWAITING_PAYMENT','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}});
  if(user.permissions.includes('claims.view_audit')) OR.push({departmentId:{in:departments(user,'AUDITOR')},status:{in:['AUDIT_REVIEW','AUDIT_CLEARED','AUDIT_QUERY','AUDIT_REJECTED','AWAITING_PAYMENT','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}});
  if(user.permissions.includes('claims.view_system')) OR.push({});
  return OR.length?{OR}:{id:{in:[]}};
}
