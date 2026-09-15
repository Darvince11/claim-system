import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxEvent } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationWorker implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  private running:Promise<void>|null=null;
  constructor(@Inject(PrismaService) private db:PrismaService){}
  onModuleInit(){this.timer=setInterval(()=>{if(!this.running)this.running=this.deliver().catch(()=>console.error('Notification delivery failed; pending events will be retried.')).finally(()=>{this.running=null;});},3000);}
  async onModuleDestroy(){clearInterval(this.timer);await this.running;}
  async deliver(){
    for(let count=0;count<10;count++){
      let eventId:string|undefined;
      try{
        const delivered=await this.db.$transaction(async tx=>{
          // Hold a row lock through local delivery so multiple workers cannot deliver the same event.
          const events=await tx.$queryRaw<OutboxEvent[]>`SELECT * FROM "OutboxEvent" WHERE "deliveredAt" IS NULL AND "availableAt" <= NOW() AND "attempts" < 8 ORDER BY "availableAt", "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
          const event=events[0];if(!event)return false;eventId=event.id;
          const payload=z.object({recipientIds:z.array(z.string().uuid()),title:z.string(),message:z.string()}).parse(event.payload);
          const now=new Date();
          const recipients=await tx.user.findMany({where:{id:{in:payload.recipientIds},active:true},select:{id:true}});
          await tx.notification.createMany({data:recipients.map(recipient=>({recipientId:recipient.id,eventKey:event.eventKey,title:payload.title,message:payload.message,claimId:event.aggregateId})),skipDuplicates:true});
          await tx.outboxEvent.update({where:{id:event.id},data:{deliveredAt:now,attempts:{increment:1},lastError:null}});return true;
        });
        if(!delivered)break;
      }catch(error){
        if(eventId)await this.db.outboxEvent.update({where:{id:eventId},data:{attempts:{increment:1},availableAt:new Date(Date.now()+60000),lastError:'Delivery failed. Inspect worker diagnostics.'}});
        throw error;
      }
    }
  }
}
