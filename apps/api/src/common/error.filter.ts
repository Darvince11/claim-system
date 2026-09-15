import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost) {
    let status=500; let message='Something went wrong. Please try again.'; let fields:unknown;
    if(error instanceof HttpException) {status=error.getStatus();const response=error.getResponse();message=typeof response==='string'?response:(response as any).message;fields=typeof response==='object'?(response as any).fieldErrors:undefined;}
    if(error instanceof Prisma.PrismaClientKnownRequestError) {
      if(['P2002','P2034'].includes(error.code)){status=409;message='This record already exists or was changed by another user. Refresh and try again.';}
      if(error.code==='P2025'){status=404;message='The requested record was not found.';}
      if(error.code==='P2003'){status=422;message='This record is referenced by other records and cannot be changed this way.';}
    }
    const requestId=randomUUID(); if(status===500) console.error({requestId,error:error instanceof Error?error.message:'Unknown error'});
    host.switchToHttp().getResponse<Response>().status(status).json({error:{code:status,message,fieldErrors:fields,requestId}});
  }
}
