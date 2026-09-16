import 'reflect-metadata';
import 'dotenv/config';
import { createApplication } from '../apps/api/src/app';
let application:ReturnType<typeof createApplication>|undefined;
export default async function handler(request:any,response:any){application??=createApplication().then(async app=>{await app.init();return app;});const app=await application;return app.getHttpAdapter().getInstance()(request,response);}
