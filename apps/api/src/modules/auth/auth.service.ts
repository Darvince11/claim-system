import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { Identity } from '../../common/types';
import { audit } from '../../common/audit';
import { newPassword, passwordInput, validate } from '../../common/validation';
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private db:PrismaService,@Inject(JwtService) private jwt:JwtService){}
  async identity(userId:string,sessionId:string):Promise<Identity> {
    const now=new Date();
    const user=await this.db.user.findUnique({where:{id:userId},include:{department:{include:{faculty:true}},scopes:{where:{validFrom:{lte:now},OR:[{validTo:null},{validTo:{gt:now}}]}},roles:{include:{role:{include:{permissions:true}}}}}});
    if(!user?.active) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return {id:user.id,name:user.name,email:user.email,staffId:user.staffId,title:user.title,employmentType:user.employmentType,category:user.category,departmentId:user.departmentId,departmentName:user.department?.name??'University administration',facultyName:user.department?.faculty.name??'UPSA',roles:user.roles.map(r=>r.role.code),permissions:[...new Set(user.roles.flatMap(r=>r.role.permissions.map(p=>p.permissionCode)))],scopes:user.scopes.map(s=>({roleCode:s.roleCode,departmentId:s.departmentId})),sessionId};
  }
  async login(identifier:string,password:string) {
    validate(passwordInput,password);
    const user=await this.db.user.findFirst({where:{OR:[{email:identifier.toLowerCase()},{staffId:identifier}]}});
    if(!user?.active || !await compare(password,user.passwordHash)) {
      await audit(this.db,null,'LOGIN_FAILED','Session',null,{});
      throw new UnauthorizedException('The staff ID/email or password is incorrect.');
    }
    const refresh=randomBytes(48).toString('base64url');
    const session=await this.db.$transaction(async tx=>{
      const session=await tx.session.create({data:{userId:user.id,familyId:randomUUID(),tokenHash:tokenHash(refresh),expiresAt:new Date(Date.now()+7*86400000)}});
      await audit(tx,{id:user.id,name:user.name,roles:[]},'LOGIN','Session',session.id);
      return session;
    });
    return this.tokens(user.id,session.id,refresh);
  }
  private async tokens(userId:string,sessionId:string,refresh:string) {
    const user=await this.identity(userId,sessionId);
    return {accessToken:await this.jwt.signAsync({sub:userId,sid:sessionId}),refresh,user};
  }
  async refresh(token:string) {
    const current=await this.db.session.findUnique({where:{tokenHash:tokenHash(token)}});
    if(!current) throw new UnauthorizedException();
    if(current.revokedAt || current.expiresAt<new Date()) {
      await this.db.session.updateMany({where:{familyId:current.familyId},data:{revokedAt:new Date()}});
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    const refresh=randomBytes(48).toString('base64url');
    const next=await this.db.$transaction(async tx=>{
      const account=await tx.user.findUnique({where:{id:current.userId}});
      if(!account?.active) throw new UnauthorizedException();
      const updated=await tx.session.updateMany({where:{id:current.id,revokedAt:null},data:{revokedAt:new Date()}});
      if(updated.count!==1) return null;
      return tx.session.create({data:{userId:current.userId,familyId:current.familyId,tokenHash:tokenHash(refresh),expiresAt:current.expiresAt}});
    });
    if(!next) {
      await this.db.session.updateMany({where:{familyId:current.familyId},data:{revokedAt:new Date()}});
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    return this.tokens(current.userId,next.id,refresh);
  }
  async authenticate(token:string) {
    try {
      const payload=await this.jwt.verifyAsync<{sub:string;sid:string}>(token);
      const session=await this.db.session.findFirst({where:{id:payload.sid,userId:payload.sub,revokedAt:null,expiresAt:{gt:new Date()}}});
      if(!session) throw new Error('Revoked');
      return await this.identity(payload.sub,payload.sid);
    } catch { throw new UnauthorizedException('Please sign in to continue.'); }
  }
  async logout(user:Identity) {await this.db.$transaction(async tx=>{await tx.session.updateMany({where:{id:user.sessionId},data:{revokedAt:new Date()}});await audit(tx,user,'LOGOUT','Session',user.sessionId);});}
  async changePassword(user:Identity,current:string,next:string) {
    validate(passwordInput,current);validate(newPassword,next);
    const record=await this.db.user.findUniqueOrThrow({where:{id:user.id}});
    if(!await compare(current,record.passwordHash)) throw new UnauthorizedException('The current password is incorrect.');
    const passwordHash=await hash(next,12);
    await this.db.$transaction(async tx=>{await tx.user.update({where:{id:user.id},data:{passwordHash}});await tx.session.updateMany({where:{userId:user.id,id:{not:user.sessionId}},data:{revokedAt:new Date()}});await audit(tx,user,'PASSWORD_CHANGED','User',user.id);});
  }
  async resetPassword(token:string,password:string) {
    validate(newPassword,password);
    const reset=await this.db.resetToken.findUnique({where:{tokenHash:tokenHash(token)}});
    if(!reset || reset.consumedAt || reset.expiresAt<new Date()) throw new UnauthorizedException('This reset link is invalid or has expired.');
    const passwordHash=await hash(password,12);
    await this.db.$transaction(async tx=>{
      const result=await tx.resetToken.updateMany({where:{id:reset.id,consumedAt:null},data:{consumedAt:new Date()}});
      if(result.count!==1) throw new UnauthorizedException();
      await tx.user.update({where:{id:reset.userId},data:{passwordHash}});
      await tx.session.updateMany({where:{userId:reset.userId},data:{revokedAt:new Date()}});
      await audit(tx,null,'PASSWORD_RESET','User',reset.userId);
    });
  }
}
