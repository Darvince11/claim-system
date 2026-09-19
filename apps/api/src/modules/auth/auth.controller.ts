import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import { Identity } from '../../common/types';
import { validate, passwordInput, newPassword } from '../../common/validation';
import { webOrigin } from '../../common/runtime';
const cookieOptions=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:(process.env.COOKIE_SAME_SITE==='none'?'none':'strict') as 'none'|'strict',path:'/api/v1/auth',maxAge:7*86400000});
const authThrottle={default:{limit:Number(process.env.AUTH_RATE_LIMIT_MAX??8),ttl:Number(process.env.AUTH_RATE_LIMIT_TTL_MS??60000)}};
const allowedRefreshOrigin=(origin:string|undefined)=>{
  if(!origin) return false;
  if(origin===webOrigin()) return true;
  if(process.env.NODE_ENV==='production') return false;
  return ['http://localhost:5173','http://127.0.0.1:5173'].includes(origin);
};
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private auth:AuthService){}
  @Post('login') @Throttle(authThrottle)
  async login(@Body() body:unknown,@Res({passthrough:true}) response:Response) {
    const data=validate(z.object({identifier:z.string().trim().min(1).max(200),password:passwordInput}).strict(),body);
    const {refresh,...result}=await this.auth.login(data.identifier,data.password);response.cookie('upsa_refresh',refresh,cookieOptions());return {data:result};
  }
  @Post('refresh')
  async refresh(@Req() request:Request,@Res({passthrough:true}) response:Response) {
    if(!allowedRefreshOrigin(request.headers.origin)) throw new ForbiddenException('Invalid request origin.');
    const {refresh,...result}=await this.auth.refresh(request.cookies.upsa_refresh??'');response.cookie('upsa_refresh',refresh,cookieOptions());return {data:result};
  }
  @Post('logout') @UseGuards(AuthGuard)
  async logout(@CurrentUser() user:Identity,@Res({passthrough:true}) response:Response) {await this.auth.logout(user);response.clearCookie('upsa_refresh',cookieOptions());return {data:{ok:true}};}
  @Get('me') @UseGuards(AuthGuard) me(@CurrentUser() user:Identity) {return {data:user};}
  @Post('reset-password') @Throttle(authThrottle)
  async reset(@Body() body:unknown) {const data=validate(z.object({token:z.string().min(20).max(200),password:newPassword}).strict(),body);await this.auth.resetPassword(data.token,data.password);return {data:{ok:true}};}
}
