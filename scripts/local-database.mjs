import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
if(process.env.NODE_ENV==='production') throw new Error('Local development database must not run in production.');
mkdirSync('.local',{recursive:true});
const configPath=path.resolve('.local/database.json');
const config=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):{user:'upsa_local',password:randomBytes(24).toString('hex'),port:55432};
if(!existsSync(configPath)) writeFileSync(configPath,JSON.stringify(config),{mode:0o600});
const db=new EmbeddedPostgres({databaseDir:path.resolve('.local/postgres'),user:config.user,password:config.password,port:config.port,persistent:true,authMethod:'scram-sha-256',onLog:()=>{},onError:message=>console.error(message)});
if(!existsSync('.local/postgres/PG_VERSION')) await db.initialise();
await db.start();
try{await db.createDatabase('upsa_claims');}catch(error){if(!String(error).includes('already exists')) throw error;}
if(!existsSync('.env')) {
  const password=randomBytes(16).toString('base64url');
  writeFileSync('.env',`NODE_ENV=development\nDATABASE_URL=postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/upsa_claims\nJWT_SECRET=${randomBytes(48).toString('hex')}\nPORT=3001\nWEB_ORIGIN=http://localhost:5173\nSEED_PASSWORD=${password}\nSEED_DEMO_DATA=true\n`,{mode:0o600});
  writeFileSync('.local/development-accounts.txt',`LOCAL DEVELOPMENT ONLY\nPassword for seeded accounts: ${password}\n\nlecturer@example.test\nhod@example.test\nprovc@example.test\nfinance@example.test\nauditor@example.test\nadmin@example.test\n`,{mode:0o600});
}
console.log('Local PostgreSQL ready on 127.0.0.1:55432. Configuration is in .env; development account details are in .local/development-accounts.txt.');
const shutdown=async()=>{await db.stop();process.exit(0);};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
setInterval(()=>{},60000);
