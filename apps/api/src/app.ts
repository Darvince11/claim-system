import { Controller, Get, Inject, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { ErrorFilter } from './common/error.filter';
import { webOrigin } from './common/runtime';
import { PrismaService } from './database/prisma.service';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { AuditController } from './modules/audit/audit.controller';
import { AuditService } from './modules/audit/audit.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthGuard } from './modules/auth/auth.guard';
import { AuthService } from './modules/auth/auth.service';
import { ClaimsController } from './modules/claims/claims.controller';
import { ClaimsService } from './modules/claims/claims.service';
import { NotificationWorker } from './modules/claims/notification.worker';
import { ReportsController } from './modules/reports/reports.controller';
import { ReportsService } from './modules/reports/reports.service';
import { WorkspaceController } from './modules/workspace/workspace.controller';

@Controller('health') class HealthController {
  constructor(@Inject(PrismaService) private db:PrismaService){}
  @Get() health(){return {data:{status:'ok'}};}
  @Get('ready') async ready(){await this.db.$queryRaw`SELECT 1`;return {data:{status:'ready'}};}
}
@Module({imports:[JwtModule.register({secret:process.env.JWT_SECRET,signOptions:{expiresIn:'15m'}}),ThrottlerModule.forRoot([{ttl:Number(process.env.RATE_LIMIT_TTL_MS??60000),limit:Number(process.env.RATE_LIMIT_MAX??180)}])],controllers:[HealthController,AuthController,AdminController,WorkspaceController,ClaimsController,AuditController,ReportsController],providers:[PrismaService,AuthService,AuthGuard,AdminService,ClaimsService,NotificationWorker,AuditService,ReportsService,{provide:APP_GUARD,useClass:ThrottlerGuard}]})
export class AppModule {}
export async function createApplication(){
  const origin=webOrigin();if(!process.env.DATABASE_URL||!origin||!process.env.JWT_SECRET||process.env.JWT_SECRET.length<48)throw new Error('Configure DATABASE_URL, WEB_ORIGIN (or VERCEL_URL), and a JWT_SECRET of at least 48 characters.');
  const app=await NestFactory.create(AppModule,{bodyParser:false});
  app.use(helmet());app.use(json({limit:'256kb'}));app.use(cookieParser());app.enableCors({origin,credentials:true});
  app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ErrorFilter());return app;
}
