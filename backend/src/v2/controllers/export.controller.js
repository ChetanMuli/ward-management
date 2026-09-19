const { Op }=require('sequelize');
const {House,Family,Person,VoterProfile,Complaint,Area,Apartment,Ward,Shop}=require('../../models');
const {getScope,isWardAllowed}=require('../services/wardScope');
const asyncHandler=require('../../utils/asyncHandler');
const ApiError=require('../../utils/ApiError');
const ExcelJS=require('exceljs');
const PDFDocument=require('pdfkit');

function presenceWhere(req,type){
  const presence=String(req.query.presenceStatus||'').toUpperCase();
  const outCity=['outOfCity','out-of-city','outOfCityVoters','out-of-city-voters'].includes(type);
  if(outCity||presence==='OUT_OF_CITY') return 'OUT_OF_CITY';
  if(presence==='AT_HOME') return 'AT_HOME';
  return null;
}
function voterWhere(req,type){
  const status=String(req.query.voterStatus||req.query.status||'').toUpperCase();
  if(['outOfCityVoters','out-of-city-voters'].includes(type)) return 'VOTER';
  if(['votersOnly','voters-only','voter'].includes(type)) return 'VOTER';
  if(['nonVoters','non-voters','nonVoter','non-voter'].includes(type)) return 'NON_VOTER';
  if(['VOTER','NON_VOTER','NOT_SPECIFIED'].includes(status)) return status;
  return null;
}

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
 const houseInclude={model:House,as:'house',where:areaFilter,required:Boolean(areaIds),include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]},{model:Apartment,as:'apartment',attributes:['id','name']}]};
 const presence=presenceWhere(req,type);
 const voterStatus=voterWhere(req,type);
 const personWhere={status:'ACTIVE',...(presence?{presenceStatus:presence}:{})};
 const voterIncludeWhere=voterStatus?{status:voterStatus}:undefined;

 if(type==='houses')return House.findAll({where:areaFilter,include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]});
 if(type==='families')return Family.findAll({include:[houseInclude,{model:Person,as:'members',where:{status:'ACTIVE'},required:false}]});
 if(type==='shops')return Shop.findAll({where:areaFilter,include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]});
 if(['persons','citizens','outOfCity','out-of-city','outOfCityVoters','out-of-city-voters'].includes(type)){
   return Person.findAll({
     where:personWhere,
     include:[
       {model:VoterProfile,as:'voterProfile',where:voterIncludeWhere,required:Boolean(voterStatus)},
       {model:Family,as:'family',include:[houseInclude]}
     ]
   });
 }
 if(['voters','votersOnly','voters-only','voter','nonVoters','non-voters','nonVoter','non-voter'].includes(type)){
   return VoterProfile.findAll({
     where:voterStatus?{status:voterStatus}:{status:{[Op.in]:['VOTER','NON_VOTER','NOT_SPECIFIED']}},
     include:[{
       model:Person,
       as:'Person',
       where:{status:'ACTIVE',...personWhere},
       required:true,
       include:[{model:Family,as:'family',include:[houseInclude]}]
     }]
   });
 }
 if(type==='complaints')return Complaint.findAll({include:[{model:Person,as:'citizen',attributes:['fullName']},{...houseInclude}]});
 throw new ApiError(400,'Unsupported export type');
}
function presenceLabel(status){
  if(status==='OUT_OF_CITY') return 'Out of city';
  if(status==='AT_HOME') return 'At house';
  return '';
}
function flat(type,r){
  const x=r.toJSON();
  const kind=['outOfCity','out-of-city','outOfCityVoters','out-of-city-voters'].includes(type)?'citizens':(['votersOnly','voters-only','voter','nonVoters','non-voters','nonVoter','non-voter'].includes(type)?'voters':type);
  if(kind==='houses')return {House:x.houseNumber,Address:x.address,Landmark:x.landmark||'',City:x.city||x.area?.city||'',Pincode:x.pincode||x.area?.pincode||'',Latitude:x.latitude||'',Longitude:x.longitude||'',Owner:x.ownerName,Ownership:x.ownership,Type:x.houseType,Ward:x.area?.ward?.wardNumber,Area:x.area?.name,Status:x.status};
  if(kind==='families')return {Family:x.familyName,House:x.house?.houseNumber||'',Apartment:x.house?.apartment?.name||'',Address:x.house?.address||'',Colony:x.house?.area?.name||'',Ward:x.house?.area?.ward?.wardNumber||'',NativeVillage:x.nativeVillage||'',NativeTaluka:x.nativeTaluka||'',NativeDistrict:x.nativeDistrict||'',NativeState:x.nativeState||'',Latitude:x.house?.latitude||'',Longitude:x.house?.longitude||'',Members:(x.members||[]).length,Status:x.status};
  if(kind==='shops')return {Name:x.name,Type:x.kind==='OFFICE'?'Office':'Shop',Category:x.category||'',Ownership:x.ownership||'',Owner:x.ownerName||'',Mobile:x.ownerMobile||'',Address:x.address||'',Landmark:x.landmark||'',Ward:x.area?.ward?.wardNumber||'',Colony:x.area?.name||'',Latitude:x.latitude||'',Longitude:x.longitude||'',Status:x.status||''};
  if(kind==='persons'||kind==='citizens')return {Name:x.fullName,Gender:x.gender,DOB:x.dob,Age:x.age,Mobile:x.mobile,AlternateMobile:x.alternateMobile||'',Email:x.email||'',Occupation:x.occupation,Company:x.companyName||'',Business:x.businessName||'',WhereNow:presenceLabel(x.presenceStatus),CurrentCity:x.currentCity||'',LivingWith:x.livingWith||'',Voter:x.voterProfile?.status||'',VotingWard:x.voterProfile?.votingWard||'',VoterID:x.voterProfile?.officialVoterIdRef||'',Family:x.family?.familyName||'',House:x.family?.house?.houseNumber||'',Ward:x.family?.house?.area?.ward?.wardNumber||'',Colony:x.family?.house?.area?.name||'',Status:x.status};
  if(kind==='voters'){
    const p=x.Person||{};
    return {Name:p.fullName||'',Age:p.age??'',Mobile:p.mobile||'',WhereNow:presenceLabel(p.presenceStatus),CurrentCity:p.currentCity||'',Family:p.family?.familyName||'',House:p.family?.house?.houseNumber||'',Ward:p.family?.house?.area?.ward?.wardNumber||'',Colony:p.family?.house?.area?.name||'',VoterStatus:x.status,VotingWard:x.votingWard||'',VoterRef:x.officialVoterIdRef||'',Constituency:x.constituency||''};
  }
  return {'Complaint No':x.complaintNumber,Status:x.status,Ward:x.house?.area?.ward?.wardNumber||'',Colony:x.house?.area?.name||'',House:x.house?.houseNumber||'',Citizen:x.citizen?.fullName||'',Description:x.description};
}
const exportData=asyncHandler(async(req,res)=>{
  if(!req.user.permissions.includes('EXPORT_DATA'))throw new ApiError(403,'Export permission is required');
  const type=req.params.type;
  const format=(req.query.format||'xlsx').toLowerCase();
  const rows=(await rowsFor(type,req)).map(r=>flat(type,r));
  if(format==='xlsx'){
    const wb=new ExcelJS.Workbook();
    const ws=wb.addWorksheet(type);
    if(rows.length){ws.columns=Object.keys(rows[0]).map(k=>({header:k,key:k,width:24}));ws.addRows(rows);}
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="ward-${type}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  }
  if(format==='pdf'){
    const doc=new PDFDocument({margin:30,size:'A4',layout:'landscape'});
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="ward-${type}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).text(`Ward Management - ${type.toUpperCase()}`);
    doc.moveDown();
    rows.slice(0,200).forEach((row,i)=>{doc.fontSize(8).text(`${i+1}. ${Object.entries(row).map(([k,v])=>`${k}: ${v??''}`).join(' | ')}`);doc.moveDown(0.3);});
    doc.end();
    return;
  }
  throw new ApiError(400,'format must be xlsx or pdf');
});
module.exports={exportData};
