import 'reflect-metadata';
import 'dotenv/config';
import { createApplication } from '../apps/api/src/app';
let application:ReturnType<typeof createApplication>|undefined;
export default async function handler(request:any,response:any){try{application??=createApplication().then(async app=>{await app.init();return app;});const app=await application;return app.getHttpAdapter().getInstance()(request,response);}catch(error){console.error('Claims API bootstrap failed.',error);return response.status(500).json({error:{message:'The Claims API is not configured correctly. An administrator must complete the Vercel database and security settings.'}});}}
