const { Op }=require('sequelize');
const {House,Family,Person,VoterProfile,Complaint,Area,Ward}=require('../../models');
const {getScope,isWardAllowed}=require('../services/wardScope');
const asyncHandler=require('../../utils/asyncHandler');
const ApiError=require('../../utils/ApiError');
const ExcelJS=require('exceljs');
const PDFDocument=require('pdfkit');

async function rowsFor(type,req){
 const {areaIds:scopedAreaIds}=await getScope(req);
 const requestedWard=req.query.wardId||null, requestedArea=req.query.areaId||null;
 if(requestedWard && !isWardAllowed(req,requestedWard)) throw new ApiError(403,'You do not have access to this ward');
 let areaIds=scopedAreaIds;
 if(req.user.roleName==='SUPER_ADMIN'||req.user.roleName==='SUB_MASTER_ADMIN'){
   if(requestedArea){const a=await Area.findByPk(requestedArea,{attributes:['id','wardId']});if(!a||!isWardAllowed(req,a.wardId))throw new ApiError(403,'You do not have access to this area');areaIds=[requestedArea];}
   else if(requestedWard){ const areas=await Area.findAll({where:{wardId:requestedWard},attributes:['id']}); areaIds=areas.map(a=>a.id);}
   else if(req.user.roleName==='SUPER_ADMIN') areaIds=null;
 } else if(req.user.roleName==='SUPER_ADMIN'){
   if(requestedArea) areaIds=[requestedArea];
   else if(requestedWard){
     const areas=await Area.findAll({where:{wardId:requestedWard},attributes:['id']});
     areaIds=areas.map(a=>a.id);
   } else areaIds=null;
 }
 const areaFilter=areaIds?{areaId:{[Op.in]:areaIds.length?areaIds:['00000000-0000-0000-0000-000000000000']}}:{};
 const houseInclude={model:House,as:'house',where:areaFilter,required:Boolean(areaIds),include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]};
 if(type==='houses')return House.findAll({where:areaFilter,include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]});
 if(type==='families')return Family.findAll({include:[houseInclude]});
 if(type==='persons'||type==='citizens')return Person.findAll({include:[{model:VoterProfile,as:'voterProfile'},{model:Family,as:'family',include:[houseInclude]}]});
 if(type==='voters')return VoterProfile.findAll({include:[{model:Person,as:'Person',include:[{model:Family,as:'family',include:[houseInclude]}]}]});
 if(type==='complaints')return Complaint.findAll({include:[{model:Person,as:'citizen',attributes:['fullName']},{...houseInclude}]});
 throw new ApiError(400,'Unsupported export type');
}
function flat(type,r){const x=r.toJSON();if(type==='houses')return {House:x.houseNumber,Address:x.address,Landmark:x.landmark||'',City:x.city||x.area?.city||'',Pincode:x.pincode||x.area?.pincode||'',Latitude:x.latitude||'',Longitude:x.longitude||'',Owner:x.ownerName,Ownership:x.ownership,Type:x.houseType,Ward:x.area?.ward?.wardNumber,Area:x.area?.name,Status:x.status};if(type==='families')return {Family:x.familyName,House:x.house?.houseNumber||'',Address:x.house?.address||'',Colony:x.house?.area?.name||'',Ward:x.house?.area?.ward?.wardNumber||'',Latitude:x.house?.latitude||'',Longitude:x.house?.longitude||'',Status:x.status};if(type==='persons'||type==='citizens')return {Name:x.fullName,Gender:x.gender,DOB:x.dob,Age:x.age,Mobile:x.mobile,AlternateMobile:x.alternateMobile||'',Email:x.email||'',Occupation:x.occupation,Company:x.companyName||'',Business:x.businessName||'',WhereNow:x.presenceStatus==='OUT_OF_CITY'?'Out of city':x.presenceStatus==='AT_HOME'?'At house':'',CurrentCity:x.currentCity||'',LivingWith:x.livingWith||'',Voter:x.voterProfile?.status||'',VotingWard:x.voterProfile?.votingWard||'',VoterID:x.voterProfile?.officialVoterIdRef||'',Status:x.status};if(type==='voters')return {'Person ID':x.personId,Status:x.status,Constituency:x.constituency,'Voting Ward':x.votingWard,'Voter Ref':x.officialVoterIdRef};return {'Complaint No':x.complaintNumber,Status:x.status,Ward:x.house?.area?.ward?.wardNumber||'',Colony:x.house?.area?.name||'',House:x.house?.houseNumber||'',Citizen:x.citizen?.fullName||'',Description:x.description};}
const exportData=asyncHandler(async(req,res)=>{if(!req.user.permissions.includes('EXPORT_DATA'))throw new ApiError(403,'Export permission is required');const type=req.params.type;const format=(req.query.format||'xlsx').toLowerCase();const rows=(await rowsFor(type,req)).map(r=>flat(type,r));if(format==='xlsx'){const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet(type);if(rows.length){ws.columns=Object.keys(rows[0]).map(k=>({header:k,key:k,width:24}));ws.addRows(rows);}res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="ward-${type}.xlsx"`);await wb.xlsx.write(res);return res.end();}if(format==='pdf'){const doc=new PDFDocument({margin:30,size:'A4',layout:'landscape'});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="ward-${type}.pdf"`);doc.pipe(res);doc.fontSize(16).text(`Ward Management - ${type.toUpperCase()}`);doc.moveDown();rows.slice(0,200).forEach((row,i)=>{doc.fontSize(8).text(`${i+1}. ${Object.entries(row).map(([k,v])=>`${k}: ${v??''}`).join(' | ')}`);doc.moveDown(0.3);});doc.end();return;}throw new ApiError(400,'format must be xlsx or pdf');});
module.exports={exportData};
