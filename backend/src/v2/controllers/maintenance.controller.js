const { Op } = require('sequelize');
const { AuditLog, Ward, Area, House, Family, Person, VoterProfile, Complaint, GovernmentVoterList, NagarsevakSchedule } = require('../../models');
const fs=require('fs');
const path=require('path');
const GOV_STORAGE=path.resolve(__dirname,'../../../storage/government-voter-lists');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

async function cleanupAuditLogs(days=2){
  const cutoff=new Date(Date.now()-days*24*60*60*1000);
  return AuditLog.destroy({where:{createdAt:{[Op.lt]:cutoff}}});
}
async function cleanupRecycleBin(days=30){
  const cutoff=new Date(Date.now()-days*24*60*60*1000);
  let total=0;
  for(const Model of [Ward,Area,House,Family,Person,VoterProfile,Complaint,NagarsevakSchedule]){
    const deletedCol=Model.options.deletedAt||Model.rawAttributes.deletedAt?.field||'deletedAt';
    total += await Model.destroy({where:{[deletedCol]:{[Op.lt]:cutoff}},paranoid:false});
  }
  const gov=await GovernmentVoterList.findAll({where:{deletedAt:{[Op.lt]:cutoff}},paranoid:false});
  for(const row of gov){try{await fs.promises.unlink(path.join(GOV_STORAGE,row.storedFileName));}catch(_){ } await row.destroy({force:true}); total+=1;}
  return total;
}
const clearAudit=asyncHandler(async(req,res)=>{
  const count=await AuditLog.destroy({where:{}});
  return success(res,{data:{deleted:count},message:`${count} audit log${count===1?'':'s'} cleared successfully`});
});
const clearRecycle=asyncHandler(async(req,res)=>{
  const count=await cleanupRecycleBin(0);
  return success(res,{data:{deleted:count},message:`${count} recycle record${count===1?'':'s'} permanently cleared`});
});
const maintenance=asyncHandler(async(req,res)=>{
  const audit=await cleanupAuditLogs(2);
  const recycle=await cleanupRecycleBin(30);
  return success(res,{data:{auditDeleted:audit,recycleDeleted:recycle}});
});
module.exports={cleanupAuditLogs,cleanupRecycleBin,clearAudit,clearRecycle,maintenance};
