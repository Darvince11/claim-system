import { CanActivate, ExecutionContext, Inject, Injectable, createParamDecorator, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private auth:AuthService){}
  async canActivate(context:ExecutionContext) {
    const request=context.switchToHttp().getRequest();
    const header=request.headers.authorization;
    if(!header?.startsWith('Bearer ')) throw new UnauthorizedException('Please sign in to continue.');
    request.user=await this.auth.authenticate(header.slice(7));return true;
  }
}
export const CurrentUser=createParamDecorator((_data:unknown,context:ExecutionContext)=>context.switchToHttp().getRequest().user);
