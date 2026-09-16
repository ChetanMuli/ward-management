const { Op } = require('sequelize');
const { House, Family, Person, VoterProfile, Complaint, Area, Ward, User, Role, Employee } = require('../../models');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { daysTo18thBirthday, daysToNextBirthday } = require('../../services/age.service');
const { isWardAllowed, allowedWardIds } = require('../services/wardScope');

const OPEN_STATUSES=['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','REOPENED'];
const STATUS_LIST=['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED'];
const EMPTY_ID='00000000-0000-0000-0000-000000000000';

function scopeWardIds(requestedWardId, accessibleWardIds){
  if(requestedWardId) return [requestedWardId];
  return accessibleWardIds;
}

function houseAreaInclude(){
  return [{
    model:House, as:'house', required:false,
    include:[{model:Area, as:'area', required:false, include:[{model:Ward, as:'ward', required:false, attributes:['id','wardNumber','name']}]}]
  }];
}

function applyComplaintWard(where, ids){
  if(ids===null) return where;
  const list=ids.length?ids:[EMPTY_ID];
  where[Op.and]=[...(where[Op.and]||[]), {[Op.or]:[{wardId:{[Op.in]:list}},{'$house.area.ward.id$':{[Op.in]:list}}]}];
  return where;
}

const summary = asyncHandler(async (req, res) => {
  const requestedWardId = req.query.wardId || (req.user.roleName==='SUPER_ADMIN'||req.user.roleName==='SUB_MASTER_ADMIN' ? null : req.user.wardId);
  if(requestedWardId && !isWardAllowed(req,requestedWardId)) return res.status(403).json({success:false,message:'You do not have access to this ward',errors:null});
  const accessibleWardIds=allowedWardIds(req);
  let ward = null;
  if (requestedWardId) {
    ward = await Ward.findByPk(requestedWardId);
    if (!ward) return res.status(400).json({ success:false, message:'Ward not found', errors:null });
  }

  const areaWhere = requestedWardId
    ? { wardId: requestedWardId }
    : (accessibleWardIds===null?{}:{wardId:{[Op.in]:accessibleWardIds.length?accessibleWardIds:[EMPTY_ID]}});
  const areas = await Area.findAll({ where: areaWhere, attributes:['id'] });
  const areaIds = areas.map(a=>a.id);
  const needsAreaScope = Boolean(requestedWardId) || accessibleWardIds!==null;
  const areaFilter = needsAreaScope
    ? { areaId:{[Op.in]:areaIds.length?areaIds:[EMPTY_ID]} }
    : {};

  const familyInclude = needsAreaScope ? [{ model:House, as:'house', where:areaFilter, required:true }] : [];
  const personInclude = [
    { model: VoterProfile, as:'voterProfile' },
    ...(needsAreaScope ? [{ model:Family, as:'family', include:[{ model:House, as:'house', where:areaFilter, required:true }], required:true }] : [])
  ];

  const complaintScope={};
  if(req.user.roleName==='EMPLOYEE'){
    if(!req.user.employeeProfile?.id) return res.status(403).json({success:false,message:'Employee profile is missing',errors:null});
    complaintScope.assignedEmployeeId=req.user.employeeProfile.id;
  }
  applyComplaintWard(complaintScope, scopeWardIds(requestedWardId, accessibleWardIds));
  const complaintInclude=houseAreaInclude();
  const countOpts={ include:complaintInclude, distinct:true, subQuery:false };
  const whereWith=(extra)=>({[Op.and]:[complaintScope, extra]});

  const statusCounts={};
  const [houses,families,scopedPeople,complaints,openComplaints,managedEmployees,corporatorCount] = await Promise.all([
    House.count({ where:areaFilter }),
    Family.count({ where:{}, include:familyInclude, distinct:true }),
    Person.findAll({ where:{status:'ACTIVE'}, include:personInclude }),
    Complaint.count({ where:complaintScope, ...countOpts }),
    Complaint.count({ where:whereWith({status:{[Op.in]:OPEN_STATUSES}}), ...countOpts }),
    req.user.roleName==='NAGARSEVAK' ? Employee.count({where:{managerUserId:req.user.id,status:'ACTIVE'}}) : Promise.resolve(0),
    ['SUPER_ADMIN','SUB_MASTER_ADMIN'].includes(req.user.roleName) ? (async()=>{const r=await Role.findOne({where:{name:'NAGARSEVAK'}});const wardWhere=requestedWardId?{wardId:requestedWardId}:accessibleWardIds===null?{}:{wardId:{[Op.in]:accessibleWardIds.length?accessibleWardIds:[EMPTY_ID]}};return r?User.count({where:{roleId:r.id,status:'ACTIVE',...wardWhere}}):0})() : Promise.resolve(0),
  ]);
  const persons=scopedPeople.length;
  const voters=scopedPeople.filter(p=>p.voterProfile?.status==='VOTER').length;
  const nonVoters=scopedPeople.filter(p=>p.voterProfile?.status==='NON_VOTER').length;

  const statusResults=await Promise.all(STATUS_LIST.map(status=>
    Complaint.count({where:whereWith({status}), ...countOpts}).then(count=>[status,count])
  ));
  statusResults.forEach(([status,count])=>{statusCounts[status]=count;});

  const recent=await Complaint.findAll({
    where:complaintScope,
    include:[
      { model:Person, as:'citizen', required:false, attributes:['id','fullName','mobile'] },
      { model:User, as:'submittedBy', required:false, attributes:['id','name','email','mobile'] },
      { model:Ward, as:'ward', required:false, attributes:['id','wardNumber','name'] },
      { model:User, as:'assignedNagarsevak', required:false, attributes:['id','name','mobile'] },
      { model:Employee, as:'assignedEmployee', required:false, include:[{model:User,as:'User',attributes:['id','name','mobile']},{model:User,as:'manager',attributes:['id','name','mobile']}] },
      ...houseAreaInclude(),
    ],
    order:[['createdAt','DESC']], limit:8, subQuery:false,
  });

  const birthdayCount=scopedPeople.map(p=>daysToNextBirthday(p.dob)).filter(d=>d!==null&&d>=0&&d<=30).length;
  const upcomingCount=scopedPeople.map(p=>daysTo18thBirthday(p.dob)).filter(d=>d!==null&&d>=0&&d<=90).length;
  const userInfo={id:req.user.id,name:req.user.name,email:req.user.email,mobile:req.user.mobile,role:req.user.roleName,wardId:req.user.wardId,ward:req.user.ward,photo:req.user.photo||null};
  const employeeInfo=req.user.employeeProfile?{id:req.user.employeeProfile.id,designation:req.user.employeeProfile.designation,status:req.user.employeeProfile.status,managerUserId:req.user.employeeProfile.managerUserId,manager:req.user.employeeProfile.manager,assignedAreaIds:req.user.employeeProfile.assignedAreaIds||[],permissions:req.user.employeeProfile.permissions||[]}:null;

  const nagarRole=await Role.findOne({where:{name:'NAGARSEVAK'}});
  const empRole=await Role.findOne({where:{name:'EMPLOYEE'}});
  const staffWardWhere=requestedWardId
    ? {wardId:requestedWardId}
    : (accessibleWardIds===null?{}:{wardId:{[Op.in]:accessibleWardIds.length?accessibleWardIds:[EMPTY_ID]}});
  const employeeCount=empRole?await User.count({where:{roleId:empRole.id,status:'ACTIVE',...staffWardWhere}}):0;
  let teamNagarsevaks=[];
  let teamEmployees=[];
  if(requestedWardId){
    [teamNagarsevaks,teamEmployees]=await Promise.all([
      nagarRole?User.findAll({where:{roleId:nagarRole.id,wardId:requestedWardId,status:'ACTIVE'},attributes:['id','name','mobile'],order:[['name','ASC']]}):[],
      empRole?User.findAll({where:{roleId:empRole.id,wardId:requestedWardId,status:'ACTIVE'},attributes:['id','name','mobile'],include:[{model:Employee,as:'employeeProfile',attributes:['designation']}],order:[['name','ASC']]}):[],
    ]);
  }

  return success(res,{data:{
    wardId:requestedWardId, ward, user:userInfo, employee:employeeInfo,
    houses,families,persons,voters,nonVoters,complaints,openComplaints,
    birthdaysNext30:birthdayCount,upcoming18Next90:upcomingCount,
    managedEmployees,corporatorCount,employeeCount,statusCounts,
    teamNagarsevaks,teamEmployees,
    recentComplaints:recent,
    generatedAt:new Date().toISOString(),
  }});
});
module.exports={summary};
