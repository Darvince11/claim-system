import { Prisma } from '@prisma/client';
import { Identity } from './types';
export function audit(tx:Prisma.TransactionClient,user:Pick<Identity,'id'|'name'|'roles'>|null,action:string,entityType:string,entityId:string|null,metadata:unknown={}) {
  return tx.auditLog.create({data:{actorId:user?.id,actorName:user?.name??'System',roles:user?.roles??[],action,entityType,entityId,metadata:JSON.parse(JSON.stringify(metadata))}});
}
