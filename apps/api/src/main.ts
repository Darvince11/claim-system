import 'reflect-metadata';
import 'dotenv/config';
import { createApplication } from './app';
async function bootstrap(){const app=await createApplication();app.enableShutdownHooks();await app.listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1');}
bootstrap().catch(error=>{console.error(error);process.exit(1);});
