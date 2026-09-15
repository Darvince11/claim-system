import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { PrismaClient } from '@prisma/client';
import { testClaims } from './test-claims.mjs';

const source=new URL(process.env.DATABASE_URL);
assert(['localhost','127.0.0.1'].includes(source.hostname),'Integration tests require a local database.');
assert.notEqual(process.env.NODE_ENV,'production','Do not run against production.');
const schema=`test_foundation_${randomBytes(6).toString('hex')}`;
source.searchParams.set('schema',schema);
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
const origin='http://localhost:5173';
const password=randomBytes(18).toString('base64url');
const env={...process.env,DATABASE_URL:source.toString(),NODE_ENV:'test',SEED_PASSWORD:password,JWT_SECRET:randomBytes(48).toString('hex'),PORT:String(port),WEB_ORIGIN:origin,RATE_LIMIT_MAX:'1000',AUTH_RATE_LIMIT_MAX:'1000'};
const db=new PrismaClient({datasources:{db:{url:source.toString()}}});
let server;
async function run(args){
  const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
  const [code]=await once(child,'exit');assert.equal(code,0,`${args[0]} failed`);
}
async function request(path,{token,body,method='GET',cookie,key}={}){
  const response=await fetch(`http://127.0.0.1:${port}/api/v1${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(cookie?{Cookie:cookie}:{}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function login(identifier){const result=await request('/auth/login',{method:'POST',body:{identifier,password}});assert.equal(result.status,201);return result;}
try{
  await run(['node_modules/prisma/build/index.js','migrate','deploy','--schema','apps/api/prisma/schema.prisma']);
  await run(['node_modules/tsx/dist/cli.mjs','--tsconfig','apps/api/tsconfig.json','apps/api/prisma/seed.ts']);
  server=spawn(process.execPath,['apps/api/dist/main.js'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let startupOutput='';
  server.stdout.on('data',chunk=>{startupOutput=(startupOutput+chunk).slice(-6000);});
  server.stderr.on('data',chunk=>{startupOutput=(startupOutput+chunk).slice(-6000);});
  let ready=false;
  for(let attempt=0;attempt<360;attempt++){
    if(server.exitCode!==null)throw new Error(`Test API exited before readiness: ${startupOutput}`);
    try{if((await request('/health/ready')).status===200){ready=true;break;}}catch{ /* API may still be connecting to PostgreSQL. */ }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(ready,`Test API did not become ready: ${startupOutput}`);
  assert.equal((await request('/workspace')).status,401);
  const lecturer=await login('lecturer@example.test');const token=lecturer.body.data.accessToken;
  assert.equal((await request('/workspace',{token})).status,200);
  assert.equal((await request('/users',{token})).status,403);
  const admin=await login('admin@example.test');const adminToken=admin.body.data.accessToken;
  const users=await request('/users',{token:adminToken});assert.equal(users.status,200);
  assert(!JSON.stringify(users.body).includes('passwordHash'));
  const roles=await request('/roles',{token:adminToken});
  const lecturerRole=roles.body.data.find(role=>role.code==='LECTURER');
  assert.equal((await request(`/roles/${lecturerRole.id}/permissions`,{token:adminToken,method:'PUT',body:{permissions:['users.manage']}})).status,422);
  const department=await db.department.findFirstOrThrow({where:{code:'DEMO-ACC'}});
  const createdStaff=await request('/users',{token:adminToken,method:'POST',body:{name:'Integration Lecturer',email:'integration.lecturer@example.test',staffId:'INT-LECTURER',title:'Lecturer',departmentId:department.id,employmentType:'PART_TIME',category:'LECTURER',active:true,password}});
  assert.equal(createdStaff.status,201,JSON.stringify(createdStaff.body));
  assert.equal(await db.userRole.count({where:{userId:createdStaff.body.data.id,role:{code:'LECTURER'}}}),1);
  const imported=await request('/users/import',{token:adminToken,method:'POST',body:{defaultPassword:password,users:[{name:'Integration HOD',email:'integration.hod@example.test',staffId:'INT-HOD',title:'Head of Department',departmentId:department.id,employmentType:'FULL_TIME',category:'LECTURER',active:true,roles:['LECTURER','HOD']}]}});
  assert.equal(imported.status,201,JSON.stringify(imported.body));
  const importedUser=await db.user.findUniqueOrThrow({where:{email:'integration.hod@example.test'}});
  assert.equal(await db.scopeGrant.count({where:{userId:importedUser.id,roleCode:'HOD',departmentId:department.id}}),1);
  assert.equal((await request('/users/import',{token:adminToken,method:'POST',body:{defaultPassword:password,users:[{name:'Integration Bad Scope',email:'integration.bad-scope@example.test',staffId:'INT-BAD-SCOPE',title:'Head of Department',departmentId:null,employmentType:'FULL_TIME',category:'LECTURER',active:true,roles:['HOD']}]}})).status,422);
  const provc=await login('provc@example.test');
  assert.equal((await request('/users/import',{token:provc.body.data.accessToken,method:'POST',body:{defaultPassword:password,users:[{name:'Integration Finance',email:'integration.finance@example.test',staffId:'INT-FINANCE',title:'Finance Officer',departmentId:department.id,employmentType:'FULL_TIME',category:'LECTURER',active:true,roles:['FINANCE']}]}})).status,422);
  const provcLecturerImport=await request('/users/import',{token:provc.body.data.accessToken,method:'POST',body:{defaultPassword:password,users:[{name:'Integration Pro VC Lecturer',email:'integration.provc-lecturer@example.test',staffId:'INT-PROVC-LECTURER',title:'Lecturer',departmentId:department.id,employmentType:'PART_TIME',category:'LECTURER',active:true,roles:['LECTURER']}]}});
  assert.equal(provcLecturerImport.status,201,JSON.stringify(provcLecturerImport.body));
  assert.equal((await request('/profile',{token,method:'PATCH',body:{name:'Updated Lecturer',title:'Dr.',roles:['ADMIN']}})).status,400);
  assert.equal((await request('/profile',{token,method:'PATCH',body:{name:'Updated Lecturer',title:'Dr.'}})).status,200);
  assert.equal((await db.user.findUnique({where:{id:lecturer.body.data.user.id}})).name,'Updated Lecturer');
  const other=await db.user.findUniqueOrThrow({where:{email:'other-lecturer@example.test'}});
  const notification=await db.notification.create({data:{recipientId:other.id,eventKey:'test',title:'Private',message:'Other recipient'}});
  assert.equal((await request(`/notifications/${notification.id}/read`,{token,method:'PATCH',body:{}})).status,404);
  const rotated=await request('/auth/refresh',{method:'POST',cookie:lecturer.cookie});assert.equal(rotated.status,201);
  assert.equal((await request('/auth/me',{token})).status,401);
  assert.equal((await request('/auth/refresh',{method:'POST',cookie:lecturer.cookie})).status,401);
  assert.equal((await request('/auth/me',{token:rotated.body.data.accessToken})).status,401);
  const parallelLogin=await login('lecturer@example.test');
  const parallelRefresh=await Promise.all([request('/auth/refresh',{method:'POST',cookie:parallelLogin.cookie}),request('/auth/refresh',{method:'POST',cookie:parallelLogin.cookie})]);
  assert.deepEqual(parallelRefresh.map(result=>result.status).sort(),[201,401]);
  const parallelWinner=parallelRefresh.find(result=>result.status===201);
  assert.equal((await request('/auth/me',{token:parallelWinner.body.data.accessToken})).status,401);
  const fresh=await login('lecturer@example.test');
  const reset=await request(`/users/${fresh.body.data.user.id}/reset-access`,{method:'POST',token:adminToken,body:{}});assert.equal(reset.status,201);
  assert.equal((await request('/auth/me',{token:fresh.body.data.accessToken})).status,401);
  const resetToken=new URL(reset.body.data.resetUrl).searchParams.get('token');
  assert.equal((await request('/auth/reset-password',{method:'POST',body:{token:resetToken,password:'x'.repeat(73)}})).status,400);
  assert.equal((await request('/auth/reset-password',{method:'POST',body:{token:resetToken,password}})).status,201);
  assert.equal((await request('/auth/reset-password',{method:'POST',body:{token:resetToken,password}})).status,401);
  const hod=await login('hod@example.test');
  await db.scopeGrant.updateMany({where:{userId:hod.body.data.user.id},data:{validFrom:new Date('2020-01-01'),validTo:new Date('2021-01-01')}});
  assert.equal((await request('/auth/me',{token:hod.body.data.accessToken})).body.data.scopes.length,0);
  await db.user.update({where:{id:hod.body.data.user.id},data:{active:false}});
  assert.equal((await request('/auth/me',{token:hod.body.data.accessToken})).status,401);
  const finalLogin=await login('lecturer@example.test');
  assert.equal((await request('/auth/logout',{method:'POST',token:finalLogin.body.data.accessToken,body:{}})).status,201);
  assert.equal((await request('/auth/me',{token:finalLogin.body.data.accessToken})).status,401);
  assert(await db.auditLog.count({where:{action:'PROFILE_UPDATED'}})>0);
  await assert.rejects(()=>db.academicYear.create({data:{name:'Invalid dates',startsOn:new Date('2026-12-01'),endsOn:new Date('2026-01-01')}}));
  const semester=await db.semester.findFirstOrThrow();
  const testRate={category:'TEST_ONLY',employmentType:'PART_TIME',semesterId:semester.id,rate:'1',currency:'GHS',roundingPlaces:2};
  await db.paymentRate.create({data:testRate});
  await assert.rejects(()=>db.paymentRate.create({data:testRate}));
  await testClaims({db,request,login,adminToken,hod});
  console.log('Foundation integration passed: migrations, auth, replay, reset, RBAC, scopes, profile, notifications, audit.');
}finally{
  if(server&&server.exitCode===null){server.kill();await once(server,'exit');}
  // The generated identifier contains only a fixed prefix and random hexadecimal characters.
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
}
