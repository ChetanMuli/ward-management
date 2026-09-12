const { Op, fn, col } = require('sequelize');
const { House, Person, Complaint, Family, VoterProfile, Area, Ward, Employee, User, Role } = require('../models');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { daysTo18thBirthday, daysToNextBirthday } = require('../services/age.service');

const wardInclude = (wardId) => ({
  model: Area, as: 'area', required: Boolean(wardId),
  include: [{ model: Ward, as: 'ward', required: Boolean(wardId), ...(wardId ? { where: { id: wardId } } : {}) }]
});

const scopeWard = (req) => {
  if (req.user.roleName === 'SUPER_ADMIN') return req.query.wardId || null;
  return req.user.wardId || req.user.employeeProfile?.wardId || null;
};

const summary = asyncHandler(async (req,res)=>{
  const wardId = scopeWard(req);
  const houseWhere = {};
  const houseInclude = wardId ? [wardInclude(wardId)] : [];
  const familyInclude = wardId ? [{ model: House, as:'house', required:true, include:[wardInclude(wardId)] }] : [];
  const personInclude = wardId ? [{ model: Family, as:'family', required:true, include:[{ model: House, as:'house', required:true, include:[wardInclude(wardId)] }] }] : [];
  const complaintInclude = wardId ? [{ model: House, as:'house', required:true, include:[wardInclude(wardId)] }] : [];

  const [houses,families,persons,voterRows,complaints,recent,employees,activePeople] = await Promise.all([
    House.count({where:houseWhere,include:houseInclude}),
    Family.count({include:familyInclude,distinct:true}),
    Person.count({include:personInclude}),
    VoterProfile.findAll({attributes:['status'],include:[{model:Person,required:true,include:personInclude}]}),
    Complaint.findAll({attributes:['status'],include:complaintInclude}),
    Complaint.findAll({
      limit:8,order:[['createdAt','DESC']],include:[
        {model:Person,as:'citizen',attributes:['fullName','mobile']},
        {model:House,as:'house',include:[wardInclude(wardId)]}
      ]
    }),
    Employee.count(wardId?{where:{wardId}}:{}),
    Person.findAll({where:{status:'ACTIVE'},attributes:['dob'],include:personInclude})
  ]);

  const voters=voterRows.filter(x=>x.status==='VOTER').length;
  const nonVoters=voterRows.filter(x=>x.status==='NON_VOTER').length;
  const complaintsByStatus={};
  complaints.forEach(c=>{complaintsByStatus[c.status]=(complaintsByStatus[c.status]||0)+1});
  const birthdayCount=activePeople.map(p=>daysToNextBirthday(p.dob)).filter(d=>d!==null&&d<=30).length;
  const upcoming18=activePeople.map(p=>daysTo18thBirthday(p.dob)).filter(d=>d!==null&&d>=0&&d<=90).length;
  const ward=wardId?await Ward.findByPk(wardId,{attributes:['id','wardNumber','name']}):null;

  return success(res,{data:{
    generatedAt:new Date().toISOString(), ward,
    houses, families, persons, voters, nonVoters,
    openComplaints: ['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','REOPENED'].reduce((n,s)=>n+(complaintsByStatus[s]||0),0),
    birthdaysNext30:birthdayCount, upcoming18Next90:upcoming18,
    complaintStatus:complaintsByStatus, statusCounts:complaintsByStatus,
    recentComplaints:recent,
    corporatorCount: await User.count({where:{...(wardId?{wardId}:{}),status:'ACTIVE'},include:[{model:Role,where:{name:'NAGARSEVAK'},required:true}]}),
    managedEmployees:employees
  }});
});
module.exports={summary};
