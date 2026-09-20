import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import { Identity } from '../../common/types';
import { audit } from '../../common/audit';
import { claimScope } from '../../common/policy';
import { newPassword, pagination, passwordInput, uuid, validate } from '../../common/validation';

@Controller() @UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(@Inject(PrismaService) private db:PrismaService,@Inject(AuthService) private auth:AuthService) {}

  @Get('profile') profile(@CurrentUser() user:Identity) { return {data:user}; }

  @Post('profile/change-password') async changePassword(@CurrentUser() user:Identity,@Body() body:unknown) {
    const data=validate(z.object({currentPassword:passwordInput,password:newPassword}).strict(),body);
    await this.auth.changePassword(user,data.currentPassword,data.password);
    return {data:{ok:true}};
  }

  @Get('workspace') async overview(@CurrentUser() user:Identity) {
    const where=claimScope(user);
    const [groups,recent,unread,semesters]=await Promise.all([
      this.db.claim.groupBy({by:['status'],where,_count:{_all:true}}),
      this.db.claim.findMany({where,select:{id:true,reference:true,status:true,totalHours:true,createdAt:true,semester:{select:{name:true}},lecturer:{select:{name:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:8}),
      this.db.notification.count({where:{recipientId:user.id,readAt:null}}),
      this.db.semester.findMany({where:{active:true,startsOn:{lte:new Date()},endsOn:{gte:new Date()},academicYear:{active:true}},select:{name:true,academicYear:{select:{name:true}}},orderBy:{startsOn:'desc'}}),
    ]);
    const administration=user.permissions.includes('users.manage')?{
      users:await this.db.user.count(),activeUsers:await this.db.user.count({where:{active:true}}),
    }:null;
    return {data:{counts:groups.map(group=>({status:group.status,count:group._count._all})),recent,unread,semesters,administration}};
  }

  @Get('notifications') async notifications(@CurrentUser() user:Identity,@Query() query:unknown) {
    const p=validate(pagination,query);const where={recipientId:user.id};
    const [data,total]=await Promise.all([
      this.db.notification.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(p.page-1)*p.pageSize,take:p.pageSize}),
      this.db.notification.count({where}),
    ]);
    return {data,meta:{page:p.page,pageSize:p.pageSize,total}};
  }

  @Get('notifications/unread-count') async unread(@CurrentUser() user:Identity) {
    return {data:{unread:await this.db.notification.count({where:{recipientId:user.id,readAt:null}})}};
  }

  @Patch('notifications/:id/read') async read(@CurrentUser() user:Identity,@Param('id') id:string) {
    const result=await this.db.notification.updateMany({where:{id:validate(uuid,id),recipientId:user.id},data:{readAt:new Date()}});
    if(!result.count)throw new NotFoundException();
    return {data:{ok:true}};
  }

  @Post('notifications/read-all') async readAll(@CurrentUser() user:Identity) {
    await this.db.notification.updateMany({where:{recipientId:user.id,readAt:null},data:{readAt:new Date()}});
    return {data:{ok:true}};
  }

  @Post('notifications/broadcast') async broadcast(@CurrentUser() user:Identity,@Body() body:unknown) {
    if(!user.permissions.includes('notifications.broadcast'))throw new ForbiddenException('You do not have permission to broadcast notifications.');
    const data=validate(z.object({title:z.string().trim().min(4).max(120),message:z.string().trim().min(8).max(1000),audience:z.enum(['ALL','LECTURER','HOD','PRO_VC','FINANCE','AUDITOR','ADMIN']).default('ALL')}).strict(),body);
    const recipients=await this.db.user.findMany({where:{active:true,...(data.audience==='ALL'?{}:{roles:{some:{role:{code:data.audience}}}})},select:{id:true}});
    const eventKey=`broadcast:${Date.now()}:${randomUUID()}`;
    await this.db.$transaction(async tx=>{
      if(recipients.length)await tx.notification.createMany({data:recipients.map(recipient=>({recipientId:recipient.id,eventKey,title:data.title,message:data.message})),skipDuplicates:true});
      await audit(tx,user,'NOTIFICATION_BROADCAST','Notification',null,{audience:data.audience,recipients:recipients.length,title:data.title});
    });
    return {data:{recipients:recipients.length}};
  }
}
