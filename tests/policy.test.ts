import { describe, expect, it } from 'vitest';
import { claimScope, requirePermission } from '../apps/api/src/common/policy';
import { Identity } from '../apps/api/src/common/types';

const identity:Identity={id:'owner',name:'Owner',email:'owner@example.test',staffId:'TEST',title:'Lecturer',employmentType:'PART_TIME',category:'LECTURER',departmentId:'dept-a',departmentName:'A',facultyName:'A',roles:[],permissions:[],scopes:[],sessionId:'session'};
describe('record access defaults',()=>{
  it('does not grant administrators implicit claim access',()=>{
    expect(claimScope({...identity,roles:['ADMIN'],permissions:['users.manage']})).toEqual({id:{in:[]}});
    expect(()=>requirePermission(identity,'claims.create')).toThrow();
  });
  it('derives lecturer ownership from identity',()=>{
    expect(claimScope({...identity,permissions:['claims.view_own']})).toEqual({OR:[{lecturerId:'owner'}]});
  });
  it('limits HOD claim access to their own department read-only queue',()=>{
    const scope=claimScope({...identity,permissions:['claims.view_department'],scopes:[{roleCode:'FINANCE',departmentId:'dept-b'}]});
    expect(scope).toEqual({OR:[{departmentId:{in:[]},status:{notIn:['DRAFT','CANCELLED']}}]});
    expect(()=>requirePermission({...identity,permissions:['claims.view_department','claims.approve_hod']},'claims.approve_hod')).not.toThrow();
  });
  it('limits audit claim access to authorized audit and payment history',()=>{
    const scope=claimScope({...identity,permissions:['claims.view_audit'],scopes:[{roleCode:'AUDITOR',departmentId:'dept-a'}]});
    expect(scope).toEqual({OR:[{departmentId:{in:['dept-a']},status:{in:['AUDIT_REVIEW','AUDIT_CLEARED','AUDIT_QUERY','AUDIT_REJECTED','AWAITING_PAYMENT','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}}]});
  });
  it('keeps returned and unreviewed claims out of the Pro VC queue',()=>{
    const scope=claimScope({...identity,permissions:['claims.view_provc_scope'],scopes:[{roleCode:'PRO_VC',departmentId:'dept-a'}]});
    expect(JSON.stringify(scope)).not.toContain('RETURNED_FOR_CORRECTION');
    expect(JSON.stringify(scope)).not.toContain('HOD_REVIEW');
    expect(JSON.stringify(scope)).toContain('PRO_VC_REVIEW');
  });
});
