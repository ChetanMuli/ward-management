#!/usr/bin/env node
require('dotenv').config();
const readline=require('readline');
const bcrypt=require('bcryptjs');
const {User,Role}=require('../src/models');

const args=Object.fromEntries(process.argv.slice(2).map(x=>x.startsWith('--')?x.slice(2).split('='):[]).filter(x=>x.length===2));
const email=args.email;
const password=args.password;
if(!email || !password){
 console.error('Usage: node scripts/reset-master-password.js --email=admin@example.com --password=NewStrongPassword');
 process.exit(1);
}
(async()=>{
 try{
  const role=await Role.findOne({where:{name:'SUPER_ADMIN'}});
  if(!role) throw new Error('SUPER_ADMIN role not found');
  const user=await User.findOne({where:{email,roleId:role.id}});
  if(!user) throw new Error('SUPER_ADMIN account not found for this email');
  if(password.length<8) throw new Error('Password must be at least 8 characters');
  user.passwordHash=await bcrypt.hash(password,12);
  user.status='ACTIVE';
  await user.save();
  console.log(`Master Admin password reset successfully for ${email}.`);
 }catch(e){console.error(`Password reset failed: ${e.message}`);process.exitCode=1}
 finally{process.exit()}
})();
