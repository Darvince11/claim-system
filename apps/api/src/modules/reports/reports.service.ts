import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ClaimStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Identity } from '../../common/types';
import { claimScope } from '../../common/policy';
import { date, validate } from '../../common/validation';

const reportQuery=z.object({status:z.nativeEnum(ClaimStatus).optional(),from:date.optional(),to:date.optional()}).strict();

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private db:PrismaService){}
  async summary(user:Identity,query:unknown){
    if(!user.permissions.some(permission=>permission.startsWith('reports.view_')))throw new ForbiddenException('You do not have permission to view reports.');
    const p=validate(reportQuery,query);
    const where:Prisma.ClaimWhereInput={AND:[claimScope(user),{...(p.status?{status:p.status}:{}),...(p.from||p.to?{createdAt:{...(p.from?{gte:new Date(p.from)}:{}),...(p.to?{lte:new Date(`${p.to}T23:59:59.999Z`)}:{})}}:{})}]};
    const [claims,statusRows,payments,eligible]=await Promise.all([
      this.db.claim.findMany({where,select:{id:true,reference:true,status:true,totalHours:true,eligibleHours:true,createdAt:true,lecturer:{select:{name:true}},department:{select:{name:true}},payment:{select:{amount:true,currency:true,status:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:25}),
      this.db.claim.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.payment.findMany({where:{claim:{is:where},status:'PAID'},select:{amount:true,currency:true}}),
      this.db.claim.aggregate({where,_sum:{eligibleHours:true}}),
    ]);
    const totals=payments.reduce<Record<string,string>>((acc,payment)=>({...acc,[payment.currency]:new Decimal(acc[payment.currency]??0).plus(payment.amount.toString()).toFixed(4)}),{});
    const eligibleHours=new Decimal(eligible._sum.eligibleHours?.toString()??0).toFixed(4);
    return {data:{counts:Object.fromEntries(statusRows.map(row=>[row.status,row._count._all])),totalClaims:statusRows.reduce((sum,row)=>sum+row._count._all,0),eligibleHours,paidTotals:totals,recent:claims.map(claim=>({...claim,totalHours:claim.totalHours.toString(),eligibleHours:claim.eligibleHours.toString(),payment:claim.payment?{...claim.payment,amount:claim.payment.amount.toString()}:null}))}};
  }
  async auditDashboard(user:Identity){
    if(!user.permissions.includes('claims.view_audit'))throw new ForbiddenException('You do not have permission to view the audit dashboard.');
    const where:Prisma.ClaimWhereInput={AND:[claimScope(user),{status:{in:['AUDIT_REVIEW','AUDIT_CLEARED','AUDIT_QUERY','AUDIT_REJECTED','FINANCE_PROCESSING','PAYMENT_PENDING','PAID']}}]};
    const [rows,claims,recent]=await Promise.all([
      this.db.claim.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.claim.findMany({where,select:{id:true,reference:true,status:true,totalHours:true,eligibleHours:true,createdAt:true,submittedAt:true,department:{select:{name:true}},lecturer:{select:{name:true}},history:{where:{toStatus:{in:['AUDIT_CLEARED','AUDIT_QUERY','AUDIT_REJECTED']}},select:{toStatus:true,createdAt:true},orderBy:{createdAt:'desc'},take:1}},orderBy:{submittedAt:'asc'},take:100}),
      this.db.auditLog.findMany({where:{action:{startsWith:'CLAIM_AUDIT_'}},select:{id:true,action:true,actorName:true,createdAt:true,entityId:true},orderBy:{createdAt:'desc'},take:8})
    ]);
    const counts=Object.fromEntries(rows.map(row=>[row.status,row._count._all]));
    const departmentCounts=new Map<string,number>();
    const auditDurations:number[]=[];
    for(const claim of claims){
      departmentCounts.set(claim.department.name,(departmentCounts.get(claim.department.name)??0)+1);
      const decision=claim.history[0];
      if(claim.submittedAt&&decision)auditDurations.push((decision.createdAt.getTime()-claim.submittedAt.getTime())/86400000);
    }
    const amounts=claims.map(claim=>Number(claim.eligibleHours)).filter(Number.isFinite).sort((a,b)=>a-b);
    const highValueThreshold=amounts.length?amounts[Math.max(0,Math.floor(amounts.length*.9)-1)]:0;
    const highValue=claims.filter(claim=>Number(claim.eligibleHours)>=highValueThreshold&&highValueThreshold>0).length;
    return {data:{counts,highValue,possibleDuplicates:0,missingDocuments:0,amountMismatches:0,averageAuditDays:auditDurations.length?Number((auditDurations.reduce((sum,value)=>sum+value,0)/auditDurations.length).toFixed(1)):null,departmentBreakdown:[...departmentCounts.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),recent:recent.map(item=>({...item,createdAt:item.createdAt.toISOString()})),queue:claims.filter(claim=>claim.status==='AUDIT_REVIEW').slice(0,8).map(claim=>({id:claim.id,reference:claim.reference,lecturer:claim.lecturer.name,department:claim.department.name,eligibleHours:claim.eligibleHours.toString(),submittedAt:claim.submittedAt?.toISOString()??null}))}};
  }
  async financeDashboard(user:Identity){
    if(!user.permissions.includes('claims.view_finance'))throw new ForbiddenException('You do not have permission to view the finance dashboard.');
    const where:Prisma.ClaimWhereInput={AND:[claimScope(user),{status:{in:['AUDIT_CLEARED','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}}]};
    const [rows,claims,payments]=await Promise.all([
      this.db.claim.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.claim.findMany({where,select:{id:true,reference:true,status:true,createdAt:true,department:{select:{name:true}},lecturer:{select:{name:true}},payment:{select:{amount:true,currency:true,status:true,paidOn:true,reference:true}}},orderBy:{updatedAt:'desc'},take:40}),
      this.db.payment.findMany({where:{claim:{is:where}},select:{amount:true,currency:true,status:true,paidOn:true}})
    ]);
    const counts=Object.fromEntries(rows.map(row=>[row.status,row._count._all]));
    const totals={outstanding:new Decimal(0),paidToday:new Decimal(0),paidThisMonth:new Decimal(0),paidThisYear:new Decimal(0)};
    const now=new Date();const today=now.toISOString().slice(0,10);const month=today.slice(0,7);const year=today.slice(0,4);
    for(const payment of payments){const amount=new Decimal(payment.amount.toString());const date=payment.paidOn?.toISOString().slice(0,10);if(payment.status==='PAID'){if(date===today)totals.paidToday=totals.paidToday.plus(amount);if(date?.startsWith(month))totals.paidThisMonth=totals.paidThisMonth.plus(amount);if(date?.startsWith(year))totals.paidThisYear=totals.paidThisYear.plus(amount);}else totals.outstanding=totals.outstanding.plus(amount);}
    return {data:{counts,totals:{outstanding:totals.outstanding.toFixed(2),paidToday:totals.paidToday.toFixed(2),paidThisMonth:totals.paidThisMonth.toFixed(2),paidThisYear:totals.paidThisYear.toFixed(2)},queue:claims.filter(claim=>claim.status==='AUDIT_CLEARED').map(claim=>({id:claim.id,reference:claim.reference,lecturer:claim.lecturer.name,department:claim.department.name,createdAt:claim.createdAt.toISOString()})),recent:claims.slice(0,8).map(claim=>({id:claim.id,reference:claim.reference,status:claim.status,lecturer:claim.lecturer.name,department:claim.department.name,payment:claim.payment?{...claim.payment,amount:claim.payment.amount.toString(),paidOn:claim.payment.paidOn?.toISOString()??null}:null}))}};
  }
  async auditReport(user:Identity,query:unknown){
    if(!user.permissions.includes('reports.view_audit'))throw new ForbiddenException('You do not have permission to view audit reports.');
    const p=validate(reportQuery,query);const where:Prisma.ClaimWhereInput={AND:[claimScope(user),{status:{in:['AUDIT_REVIEW','AUDIT_CLEARED','AUDIT_QUERY','AUDIT_REJECTED','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}},{...(p.from||p.to?{createdAt:{...(p.from?{gte:new Date(p.from)}:{}),...(p.to?{lte:new Date(`${p.to}T23:59:59.999Z`)}:{})}}:{})}]};
    const [rows,claims,decisions,flags]=await Promise.all([
      this.db.claim.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.claim.findMany({where,select:{id:true,reference:true,status:true,submittedAt:true,department:{select:{name:true}},lecturer:{select:{name:true,staffId:true}},history:{where:{toStatus:{in:['AUDIT_CLEARED','AUDIT_QUERY','AUDIT_REJECTED']}},select:{toStatus:true,createdAt:true,actorName:true,comment:true},orderBy:{createdAt:'desc'},take:1}},orderBy:{updatedAt:'desc'},take:100}),
      this.db.auditLog.findMany({where:{action:{startsWith:'CLAIM_AUDIT_'}},select:{id:true,action:true,actorName:true,entityId:true,createdAt:true},orderBy:{createdAt:'desc'},take:25}),
      this.db.claimFlag.count({where:{claim:{is:where}}})
    ]);
    const counts=Object.fromEntries(rows.map(row=>[row.status,row._count._all]));const department=new Map<string,number>();const durations:number[]=[];
    for(const claim of claims){department.set(claim.department.name,(department.get(claim.department.name)??0)+1);const decision=claim.history[0];if(claim.submittedAt&&decision)durations.push((decision.createdAt.getTime()-claim.submittedAt.getTime())/86400000);}
    return {data:{counts,metrics:{awaiting:counts.AUDIT_REVIEW??0,cleared:counts.AUDIT_CLEARED??0,queried:counts.AUDIT_QUERY??0,rejected:counts.AUDIT_REJECTED??0,flags,averageDays:durations.length?Number((durations.reduce((sum,value)=>sum+value,0)/durations.length).toFixed(1)):null},departments:[...department.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),decisions,claims:claims.map(claim=>({id:claim.id,reference:claim.reference,status:claim.status,lecturer:claim.lecturer,department:claim.department,decision:claim.history[0]??null}))}};
  }
  async financeReport(user:Identity,query:unknown){
    if(!user.permissions.includes('reports.view_finance'))throw new ForbiddenException('You do not have permission to view finance reports.');
    const p=validate(reportQuery,query);const where:Prisma.ClaimWhereInput={AND:[claimScope(user),{status:{in:['AUDIT_CLEARED','FINANCE_PROCESSING','PAYMENT_PENDING','PAYMENT_FAILED','PAID']}},{...(p.from||p.to?{createdAt:{...(p.from?{gte:new Date(p.from)}:{}),...(p.to?{lte:new Date(`${p.to}T23:59:59.999Z`)}:{})}}:{})}]};
    const [rows,claims,payments]=await Promise.all([
      this.db.claim.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.claim.findMany({where,select:{id:true,reference:true,status:true,department:{select:{name:true}},lecturer:{select:{name:true,staffId:true}},payment:{select:{amount:true,currency:true,status:true,reference:true,paidOn:true,notes:true}}},orderBy:{updatedAt:'desc'},take:100}),
      this.db.payment.findMany({where:{claim:{is:where}},select:{amount:true,currency:true,status:true,paidOn:true}})
    ]);
    const counts=Object.fromEntries(rows.map(row=>[row.status,row._count._all]));const totals=new Map<string,{paid:Decimal;outstanding:Decimal}>();
    for(const payment of payments){const entry=totals.get(payment.currency)??{paid:new Decimal(0),outstanding:new Decimal(0)};if(payment.status==='PAID')entry.paid=entry.paid.plus(payment.amount.toString());else entry.outstanding=entry.outstanding.plus(payment.amount.toString());totals.set(payment.currency,entry);}
    return {data:{counts,metrics:{awaiting:counts.AUDIT_CLEARED??0,processing:(counts.FINANCE_PROCESSING??0)+(counts.PAYMENT_PENDING??0),paid:counts.PAID??0,failed:counts.PAYMENT_FAILED??0},totals:[...totals.entries()].map(([currency,value])=>({currency,paid:value.paid.toFixed(2),outstanding:value.outstanding.toFixed(2)})),payments:claims.map(claim=>({id:claim.id,reference:claim.reference,status:claim.status,lecturer:claim.lecturer,department:claim.department,payment:claim.payment?{...claim.payment,amount:claim.payment.amount.toString(),paidOn:claim.payment.paidOn?.toISOString()??null}:null}))}};
  }
}
