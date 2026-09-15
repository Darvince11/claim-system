import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { Identity } from '../../common/types';
import { pagination, validate, uuid } from '../../common/validation';
@Controller() @UseGuards(AuthGuard)
export class AdminController {
  constructor(@Inject(AdminService) private service:AdminService){}
  @Get('catalog') async catalog(@CurrentUser() user:Identity) {return {data:await this.service.catalog(user)};}
  @Get('settings/claim-policy') async claimPolicy(@CurrentUser() user:Identity){return {data:await this.service.claimPolicy(user)};}
  @Put('settings/claim-policy') async savePolicy(@CurrentUser() user:Identity,@Body() body:unknown){return {data:await this.service.saveClaimPolicy(user,body)};}
  @Get('users') users(@CurrentUser() user:Identity,@Query() query:unknown) {const p=validate(pagination,query);return this.service.users(user,p.page,p.pageSize,p.search);}
  @Post('users') async createUser(@CurrentUser() user:Identity,@Body() body:unknown) {return {data:await this.service.saveUser(user,body)};}
  @Post('users/import') async importUsers(@CurrentUser() user:Identity,@Body() body:unknown) {return {data:await this.service.importUsers(user,body)};}
  @Patch('users/:id') async updateUser(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown) {return {data:await this.service.saveUser(user,body,validate(uuid,id))};}
  @Put('users/:id/roles') async assign(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown) {return {data:await this.service.assignRoles(user,validate(uuid,id),body)};}
  @Post('users/:id/reset-access') async reset(@CurrentUser() user:Identity,@Param('id') id:string) {return {data:await this.service.resetAccess(user,validate(uuid,id))};}
  @Get('roles') async roles(@CurrentUser() user:Identity) {return {data:await this.service.roles(user)};}
  @Put('roles/:id/permissions') async permissions(@CurrentUser() user:Identity,@Param('id') id:string,@Body() body:unknown) {return {data:await this.service.rolePermissions(user,validate(uuid,id),body)};}
  @Get('configuration/:resource') list(@CurrentUser() user:Identity,@Param('resource') resource:string,@Query() query:unknown) {const p=validate(pagination,query);return this.service.list(user,resource,p.page,p.pageSize,p.search);}
  @Post('configuration/:resource') async create(@CurrentUser() user:Identity,@Param('resource') resource:string,@Body() body:unknown) {return {data:await this.service.save(user,resource,body)};}
  @Patch('configuration/:resource/:id') async update(@CurrentUser() user:Identity,@Param('resource') resource:string,@Param('id') id:string,@Body() body:unknown) {return {data:await this.service.save(user,resource,body,validate(uuid,id))};}
}
