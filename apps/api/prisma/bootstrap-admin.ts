import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { rolePermissions } from '../src/common/policy';
import { newPassword, validate } from '../src/common/validation';

const db=new PrismaClient();
async function main(){
  if(await db.user.count({where:{active:true,roles:{some:{role:{code:'ADMIN'}}}}})){console.log('An active administrator already exists; skipping bootstrap.');return;}
  const name=process.env.BOOTSTRAP_ADMIN_NAME?.trim();const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();const staffId=process.env.BOOTSTRAP_ADMIN_STAFF_ID?.trim();const password=process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if(!name||!email||!staffId||!password)throw new Error('Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_STAFF_ID, and BOOTSTRAP_ADMIN_PASSWORD.');
  validate(newPassword,password);
  for(const code of new Set(Object.values(rolePermissions).flat()))await db.permission.upsert({where:{code},create:{code},update:{}});
  for(const [code,permissions] of Object.entries(rolePermissions)){
    const role=await db.role.upsert({where:{code},create:{code,name:{LECTURER:'Lecturer',HOD:'Head of Department',PRO_VC:'Pro Vice-Chancellor',FINANCE:'Finance Officer',AUDITOR:'Auditor',ADMIN:'Administrator'}[code]!},update:{}});
    for(const permissionCode of permissions)await db.rolePermission.upsert({where:{roleId_permissionCode:{roleId:role.id,permissionCode}},create:{roleId:role.id,permissionCode},update:{}});
  }
  const adminRole=await db.role.findUniqueOrThrow({where:{code:'ADMIN'}});const passwordHash=await hash(password,12);
  const user=await db.user.upsert({where:{email},create:{name,email,staffId,passwordHash},update:{name,staffId,passwordHash,active:true}});
  await db.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:adminRole.id}},create:{userId:user.id,roleId:adminRole.id},update:{}});
  console.log(`Initial administrator created: ${user.email}`);
}
main().finally(()=>db.$disconnect());
