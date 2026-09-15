import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { Identity } from '../../common/types';
import { AuditService } from './audit.service';

@Controller('audit-logs') @UseGuards(AuthGuard)
export class AuditController {
  constructor(@Inject(AuditService) private service:AuditService){}
  @Get() list(@CurrentUser() user:Identity,@Query() query:unknown){return this.service.list(user,query);}
}
