import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { Identity } from '../../common/types';
import { claimScope, requirePermission } from '../../common/policy';
import { pagination, validate } from '../../common/validation';

const auditQuery=pagination.extend({entityType:z.string().max(80).optional(),action:z.string().max(120).optional()});

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private db:PrismaService){}
  async list(user:Identity,query:unknown){
    requirePermission(user,'audit.view');
    const p=validate(auditQuery,query);
    const scope=await this.scope(user);
    const where:Prisma.AuditLogWhereInput={AND:[scope,{...(p.entityType?{entityType:p.entityType}:{}),...(p.action?{action:{contains:p.action,mode:'insensitive'}}:{}),...(p.search?{OR:[{action:{contains:p.search,mode:'insensitive'}},{entityType:{contains:p.search,mode:'insensitive'}},{actorName:{contains:p.search,mode:'insensitive'}},{entityId:{contains:p.search,mode:'insensitive'}}]}:{})}]};
    const [data,total]=await Promise.all([
      this.db.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(p.page-1)*p.pageSize,take:p.pageSize}),
      this.db.auditLog.count({where}),
    ]);
    return {data:data.map(log=>({...log,metadata:this.redact(log.metadata)})),meta:{page:p.page,pageSize:p.pageSize,total}};
  }
  private async scope(user:Identity):Promise<Prisma.AuditLogWhereInput>{
    if(user.roles.includes('ADMIN'))return {};
    if(!user.permissions.includes('claims.view_audit'))throw new ForbiddenException('You do not have permission to view audit logs.');
    const claims=await this.db.claim.findMany({where:claimScope(user),select:{id:true},take:5000});
    const ids=claims.map(claim=>claim.id);
    if(!ids.length)return {id:{in:[]}};
    return {OR:[{entityType:'Claim',entityId:{in:ids}},...ids.map(claimId=>({metadata:{path:['claimId'],equals:claimId}}))]};
  }
  private redact(value:Prisma.JsonValue){
    const clone=JSON.parse(JSON.stringify(value));
    const visit=(node:unknown):unknown=>{
      if(!node||typeof node!=='object')return node;
      if(Array.isArray(node))return node.map(visit);
      for(const key of Object.keys(node as Record<string,unknown>)){
        if(/password|token|secret|hash/i.test(key))(node as Record<string,unknown>)[key]='[redacted]';
        else (node as Record<string,unknown>)[key]=visit((node as Record<string,unknown>)[key]);
      }
      return node;
    };
    return visit(clone);
  }
}
