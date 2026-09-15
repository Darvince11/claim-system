import Decimal from 'decimal.js';
import { z } from 'zod';
import { date, decimal, uuid } from '../../common/validation';

export const itemInput=z.object({courseId:uuid,startsOn:date,endsOn:date,weeklyHours:decimal.refine(value=>new Decimal(value).lte(168),'Weekly hours cannot exceed 168.'),weeks:z.number().int().min(1).max(53),remarks:z.string().max(1000).default('')}).strict();
export const draftInput=z.object({semesterId:uuid,type:z.enum(['PART_TIME','OVERLOAD']),remarks:z.string().max(2000).default(''),items:z.array(itemInput).max(30)}).strict();
export const versionInput=z.object({expectedVersion:z.number().int().positive()}).strict();
export const hodDecisionInput=versionInput.extend({decision:z.enum(['APPROVE','RETURN','REJECT']),comment:z.string().trim().min(5).max(1000)}).strict();
export const provcDecisionInput=versionInput.extend({decision:z.enum(['APPROVE','REJECT']),comment:z.string().trim().min(5).max(1000)}).strict();
export const auditDecisionInput=versionInput.extend({decision:z.enum(['CLEAR','QUERY','REJECT']),reason:z.string().trim().min(3).max(120).default('Reviewed'),comment:z.string().trim().min(5).max(1000)}).strict();
export const paymentCompleteInput=versionInput.extend({paymentVersion:z.number().int().positive(),reference:z.string().trim().min(3).max(100),paidOn:date,notes:z.string().trim().max(1000).default('')}).strict();
export const submissionPolicy=z.object({
  approvalReference:z.string().trim().min(5).max(200),
  calendar:z.literal('CONTIGUOUS_FULL_WEEKS'),
  eligibility:z.literal('VERIFIED_ASSIGNMENTS'),
  overloadAllocation:z.literal('FULL_WORKLOAD_SINGLE_CLAIM'),
  routing:z.literal('HOME_DEPARTMENT'),
  coverage:z.literal('SINGLE_ASSIGNMENT_PER_COURSE'),
}).strict();
export type TeachingItem=z.infer<typeof itemInput>;
export function totalHours(items:Pick<TeachingItem,'weeklyHours'|'weeks'>[]){return items.reduce((sum,item)=>sum.plus(new Decimal(item.weeklyHours).times(item.weeks)),new Decimal(0));}
export function fullWeekCoverage(item:Pick<TeachingItem,'startsOn'|'endsOn'|'weeks'>){return (Date.parse(item.endsOn)-Date.parse(item.startsOn))/86400000+1===item.weeks*7;}
export function overloadHours(items:Pick<TeachingItem,'weeklyHours'|'weeks'>[],expectedWeeklyHours:string){
  if(!items.length||items.some(item=>item.weeks!==items[0].weeks))throw new Error('A common teaching period is required for this allocation policy.');
  const weekly=items.reduce((sum,item)=>sum.plus(item.weeklyHours),new Decimal(0));
  return Decimal.max(weekly.minus(expectedWeeklyHours),0).times(items[0].weeks);
}
