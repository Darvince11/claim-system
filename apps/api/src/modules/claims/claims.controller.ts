import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { Identity } from '../../common/types';
import { uuid, validate } from '../../common/validation';
import { ClaimsService } from './claims.service';

@Controller('claims') @UseGuards(AuthGuard)
export class ClaimsController {
  constructor(@Inject(ClaimsService) private service:ClaimsService){}
  @Get() list(@CurrentUser() user:Identity,@Query() query:unknown){return this.service.list(user,query);}
  @Get(':id') async detail(@CurrentUser() user:Identity,@Param('id') id:string){return {data:await this.service.detail(user,validate(uuid,id))};}
  @Post() async create(@CurrentUser() user:Identity,@Body() body:unknown,@Headers('idempotency-key') key:string){return {data:await this.service.create(user,body,key)};}
  @Patch(':id') async update(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.update(user,validate(uuid,id),body)};}
  @Post(':id/submit') async submit(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown,@Headers('idempotency-key') key:string){return {data:await this.service.submit(user,validate(uuid,id),body,key)};}
  @Post(':id/hod-decision') async hodDecision(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.hodDecision(user,validate(uuid,id),body)};}
  @Post(':id/provc-decision') async provcDecision(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.provcDecision(user,validate(uuid,id),body)};}
  @Post(':id/audit-decision') async auditDecision(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.auditDecision(user,validate(uuid,id),body)};}
  @Post(':id/finance-start') async startFinance(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.startFinance(user,validate(uuid,id),body)};}
  @Post(':id/payment-pending') async paymentPending(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.markPaymentPending(user,validate(uuid,id),body)};}
  @Post(':id/payment-complete') async paymentComplete(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.completePayment(user,validate(uuid,id),body)};}
  @Post(':id/cancel') async cancel(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown){return {data:await this.service.cancel(user,validate(uuid,id),body)};}
}
