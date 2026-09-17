const { Op } = require('sequelize');
const { sequelize, DeathRecord, DeathObservance, Person, Family, House, Area, Ward, VoterProfile, User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { assertPerson, isWardAllowed } = require('../services/wardScope');
const { logAudit } = require('../../services/audit.service');
const { addDays, addYears } = require('../../utils/calendarDates');

const fullInclude = [
  {
    model: Family, as: 'family',
    include: [
      {
        model: House, as: 'house',
        include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }],
      },
      { model: Person, as: 'members', include: [{ model: VoterProfile, as: 'voterProfile' }] },
    ],
  },
  { model: VoterProfile, as: 'voterProfile' },
  {
    model: DeathRecord, as: 'deathRecord',
    include: [{ model: User, as: 'reporter', attributes: ['id','name','email','mobile'] }],
  },
];

function formatDate(v) {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC' });
}

const list = asyncHandler(async (req, res) => {
  const where = {}; if (req.query.recordStatus && req.query.recordStatus !== 'ALL') where.recordStatus = req.query.recordStatus;
  if (req.query.fromDate || req.query.toDate) {
    where.dateOfDeath = {};
    if (req.query.fromDate) where.dateOfDeath[Op.gte] = req.query.fromDate;
    if (req.query.toDate) where.dateOfDeath[Op.lte] = req.query.toDate;
  }
  const rows = await DeathRecord.findAll({
    where: Object.keys(where).length ? where : undefined,
    include: [
      { model: Person, as: 'Person', include: fullInclude },
      { model: User, as: 'reporter', attributes: ['id','name','email','mobile'] },
      { model: DeathObservance, as: 'observance', required: false },
    ],
    order: [['dateOfDeath','DESC'], ['createdAt','DESC']],
    limit: Math.min(Number(req.query.limit)||500,500),
  });
  const requestedWardId=req.query.wardId||'';
  if(requestedWardId && !isWardAllowed(req,requestedWardId)) {
    throw new ApiError(403,'Cross-ward access denied');
  }
  const scopedRows=rows.filter(r=>{
    const wardId=r.Person?.family?.house?.area?.wardId || r.Person?.family?.house?.area?.ward?.id || null;
    const effectiveWard=requestedWardId || (req.user.roleName==='SUPER_ADMIN'?'':req.user.roleName==='SUB_MASTER_ADMIN'?(req.user.wardIds||[]):req.user.wardId);
    return Array.isArray(effectiveWard)?effectiveWard.includes(wardId):(!effectiveWard || wardId===effectiveWard);
  });
  const q=String(req.query.search||'').trim().toLowerCase();
  const filtered=q?scopedRows.filter(r=>{
    const p=r.Person;
    return [p?.fullName,p?.mobile,p?.family?.familyName,p?.family?.house?.houseNumber,
      p?.family?.house?.area?.ward?.wardNumber,p?.family?.house?.area?.name]
      .some(v=>String(v||'').toLowerCase().includes(q));
  }):scopedRows;
  const data = filtered.map(r => {
    const p = r.Person;
    const tenthDay = r.observance?.tenthDayOn || addDays(r.dateOfDeath, 10);
    const firstDeathAnniversary = r.observance?.firstYearOn || addYears(r.dateOfDeath, 1);
    return {
      id:r.id,
      recordStatus:r.recordStatus || 'ACTIVE',
      dateOfDeath:r.dateOfDeath,
      tenthDay,
      firstDeathAnniversary,
      dateOfDeathDisplay:formatDate(r.dateOfDeath),
      tenthDayDisplay:formatDate(tenthDay),
      firstDeathAnniversaryDisplay:formatDate(firstDeathAnniversary),
      notes:r.notes||null,
      verificationStatus:r.verificationStatus,
      previousVoterStatus:r.previousVoterStatus,
      restoredBy:r.restoredBy||null,
      restoredAt:r.restoredAt||null,
      reportedBy:r.reporter,
      person:p,
    };
  });
  return success(res,{data});
});

const create = asyncHandler(async (req,res) => {
  const { dateOfDeath, notes='' } = req.body;
  if (!dateOfDeath) throw new ApiError(400,'Date of death is required');
  const deathDate = new Date(`${dateOfDeath}T00:00:00Z`);
  if (Number.isNaN(deathDate.getTime())) throw new ApiError(400,'Please enter a valid death date');
  if (deathDate > new Date()) throw new ApiError(400,'Date of death cannot be in the future');

  const person = await assertPerson(req.params.personId, req);
  if (person.status === 'DECEASED') throw new ApiError(409,'This citizen is already marked deceased');
  const existing = await DeathRecord.findOne({ where:{personId:person.id} });
  if (existing) throw new ApiError(409,'A death record already exists for this citizen');

  const record = await sequelize.transaction(async transaction => {
    const voter=await VoterProfile.findOne({where:{personId:person.id},transaction});
    const previousVoterStatus=voter?.status || 'NOT_SPECIFIED';
    const created = await DeathRecord.create({
      personId:person.id,
      dateOfDeath,
      reportedBy:req.user.id,
      verificationStatus:'VERIFIED',
      previousVoterStatus,
      recordStatus:'ACTIVE',
      notes:notes || null,
    },{transaction});
    await Person.update({status:'DECEASED'},{where:{id:person.id},transaction});
    if(voter) await voter.update({status:'DECEASED'},{transaction});
    return created;
  });

  await logAudit({
    user:req.user, action:'CREATE_DEATH_RECORD', entity:'DeathRecord', recordId:record.id,
    newValue:{personId:person.id,dateOfDeath,notes}, ipAddress:req.ip,
  });
  const wardId = person.family?.house?.area?.wardId || null;
  try {
    const { notifyDeathRecordCreated } = require('../../services/wardDay.service');
    await notifyDeathRecordCreated({
      wardId,
      personName: person.fullName,
      dateOfDeath,
      personId: person.id,
      deathRecordId: record.id,
    });
  } catch (err) {
    console.error('[DEATH NOTIFY FAILURE]', err.message);
  }
  return success(res,{statusCode:201,data:{
    id:record.id,dateOfDeath:record.dateOfDeath,tenthDay:addDays(record.dateOfDeath,10),
    firstDeathAnniversary:addYears(record.dateOfDeath,1),
  },message:`Death recorded for ${person.fullName}. The citizen has been removed from active family/citizen lists.`});
});

const restore = asyncHandler(async (req,res) => {
  const record = await DeathRecord.findByPk(req.params.id, {
    include: [{ model: Person, as: 'Person', include: fullInclude }],
  });
  if (!record) throw new ApiError(404,'Death record not found');
  const person = record.Person;
  if (!person) throw new ApiError(404,'Citizen linked to this death record was not found');
  const wardId = person.family?.house?.area?.wardId || person.family?.house?.area?.ward?.id;
  if (!isWardAllowed(req, wardId)) throw new ApiError(403,'You do not have access to this ward');
  if (record.recordStatus === 'RESTORED' || person.status !== 'DECEASED') {
    throw new ApiError(400,'This death record has already been restored.');
  }
  await sequelize.transaction(async transaction => {
    await Person.update({status:'ACTIVE'},{where:{id:person.id},transaction});
    const voter=await VoterProfile.findOne({where:{personId:person.id},transaction});
    if(voter) await voter.update({status:record.previousVoterStatus || 'NOT_SPECIFIED'},{transaction});
    await record.update({recordStatus:'RESTORED',restoredBy:req.user.id,restoredAt:new Date()},{transaction});
  });
  await logAudit({user:req.user,action:'RESTORE_DEATH_RECORD',entity:'DeathRecord',recordId:record.id,newValue:{recordStatus:'RESTORED',personId:person.id},ipAddress:req.ip});
  return success(res,{message:`Death record restored. ${person.fullName} is active again.`});
});

module.exports={list,create,restore};
