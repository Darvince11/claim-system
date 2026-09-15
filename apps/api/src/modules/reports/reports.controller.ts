import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { Identity } from '../../common/types';
import { ReportsService } from './reports.service';

@Controller('reports') @UseGuards(AuthGuard)
export class ReportsController {
  constructor(@Inject(ReportsService) private service:ReportsService){}
  @Get('summary') summary(@CurrentUser() user:Identity,@Query() query:unknown){return this.service.summary(user,query);}
  @Get('audit-dashboard') auditDashboard(@CurrentUser() user:Identity){return this.service.auditDashboard(user);}
  @Get('finance-dashboard') financeDashboard(@CurrentUser() user:Identity){return this.service.financeDashboard(user);}
  @Get('audit') auditReport(@CurrentUser() user:Identity,@Query() query:unknown){return this.service.auditReport(user,query);}
  @Get('finance') financeReport(@CurrentUser() user:Identity,@Query() query:unknown){return this.service.financeReport(user,query);}
}
