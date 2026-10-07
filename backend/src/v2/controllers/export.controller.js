const { Op } = require('sequelize');
const { House, Family, Person, VoterProfile, Complaint, Area, Apartment, Ward, Shop, PersonBirthday } = require('../../models');
const { getScope, isWardAllowed } = require('../services/wardScope');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { formatWardNumber } = require('../../utils/wardFormat');

function presenceWhere(req, type) {
  const presence = String(req.query.presenceStatus || req.query.presence || '').toUpperCase();
  const outCity = ['outOfCity', 'out-of-city', 'outOfCityVoters', 'out-of-city-voters'].includes(type);
  if (outCity || presence === 'OUT_OF_CITY') return 'OUT_OF_CITY';
  if (presence === 'AT_HOME') return 'AT_HOME';
  return null;
}

function voterWhere(req, type) {
  const status = String(req.query.voterStatus || req.query.status || '').toUpperCase();
  if (['outOfCityVoters', 'out-of-city-voters', 'votersOnly', 'voters-only', 'voters', 'voter'].includes(type)) return 'VOTER';
  if (['nonVoters', 'non-voters', 'nonVoter', 'non-voter'].includes(type)) return 'NON_VOTER';
  if (['VOTER', 'NON_VOTER', 'NOT_SPECIFIED'].includes(status)) return status;
  return null;
}

function genderWhere(req) {
  const g = String(req.query.gender || '').toUpperCase();
  if (['MALE', 'FEMALE', 'OTHER'].includes(g)) return g;
  return null;
}

function getDobCondition(req) {
  const ageFilter = req.query.ageFilter || req.query.ageGroup;
  if (!ageFilter) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const normalized = String(ageFilter).toLowerCase();

  if (normalized === 'senior') {
    return { [Op.ne]: null, [Op.lte]: `${y - 60}-${m}-${d}` };
  }
  if (normalized === 'adult') {
    return { [Op.ne]: null, [Op.lte]: `${y - 18}-${m}-${d}`, [Op.gt]: `${y - 60}-${m}-${d}` };
  }
  if (normalized === 'youth') {
    return { [Op.ne]: null, [Op.lte]: `${y - 18}-${m}-${d}`, [Op.gte]: `${y - 26}-${m}-${d}` };
  }
  if (normalized === 'below18') {
    return { [Op.ne]: null, [Op.gt]: `${y - 18}-${m}-${d}` };
  }
  if (normalized === 'custom') {
    const minAge = req.query.minAge;
    const maxAge = req.query.maxAge;
    const cond = { [Op.ne]: null };
    const hasMin = minAge !== undefined && minAge !== '' && !isNaN(Number(minAge));
    const hasMax = maxAge !== undefined && maxAge !== '' && !isNaN(Number(maxAge));
    if (hasMin) {
      cond[Op.lte] = `${y - Number(minAge)}-${m}-${d}`;
    }
    if (hasMax) {
      cond[Op.gte] = `${y - Number(maxAge) - 1}-${m}-${d}`;
    }
    return (hasMin || hasMax) ? cond : null;
  }
  return null;
}

async function resolveAreaIds(req) {
  const { areaIds: scopedAreaIds } = await getScope(req);
  const requestedWard = req.query.wardId || null;
  const requestedArea = req.query.areaId || null;

  if (requestedWard && !isWardAllowed(req, requestedWard)) {
    throw new ApiError(403, 'You do not have access to this ward');
  }

  let areaIds = scopedAreaIds;
  if (req.user.roleName === 'SUPER_ADMIN' || req.user.roleName === 'SUB_MASTER_ADMIN') {
    if (requestedArea) {
      const a = await Area.findByPk(requestedArea, { attributes: ['id', 'wardId'] });
      if (!a || !isWardAllowed(req, a.wardId)) throw new ApiError(403, 'You do not have access to this area');
      areaIds = [requestedArea];
    } else if (requestedWard) {
      const areas = await Area.findAll({ where: { wardId: requestedWard }, attributes: ['id'] });
      areaIds = areas.map(a => a.id);
    } else if (req.user.roleName === 'SUPER_ADMIN') {
      areaIds = null;
    }
  } else {
    // NAGARSEVAK or EMPLOYEE
    if (requestedArea) {
      if (scopedAreaIds && !scopedAreaIds.includes(requestedArea)) throw new ApiError(403, 'You do not have access to this area');
      areaIds = [requestedArea];
    } else if (requestedWard) {
      const areas = await Area.findAll({ where: { wardId: requestedWard }, attributes: ['id'] });
      let ids = areas.map(a => a.id);
      if (scopedAreaIds) ids = ids.filter(id => scopedAreaIds.includes(id));
      areaIds = ids;
    }
  }
  return { requestedWard, requestedArea, areaIds };
}

async function rowsFor(type, req) {
  const { requestedWard, areaIds } = await resolveAreaIds(req);
  const areaFilter = areaIds ? { areaId: { [Op.in]: areaIds.length ? areaIds : ['00000000-0000-0000-0000-000000000000'] } } : {};
  const houseInclude = {
    model: House,
    as: 'house',
    where: areaFilter,
    required: Boolean(areaIds),
    include: [
      { model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] },
      { model: Apartment, as: 'apartment', attributes: ['id', 'name'] }
    ]
  };

  const presence = presenceWhere(req, type);
  const voterStatus = voterWhere(req, type);
  const gender = genderWhere(req);
  const dobCond = getDobCondition(req);

  const personWhere = { status: 'ACTIVE' };
  if (presence) personWhere.presenceStatus = presence;
  if (gender) personWhere.gender = gender;
  if (dobCond) personWhere.dob = dobCond;
  if (type === 'retiredPersons' || req.query.isRetired === 'true') {
    personWhere[Op.or] = [{ isRetired: true }, { occupationType: 'RETIRED' }];
  }
  if (req.query.search) {
    const s = String(req.query.search).trim();
    if (s) {
      const sCond = [
        { fullName: { [Op.like]: `%${s}%` } },
        { mobile: { [Op.like]: `%${s}%` } },
        { alternateMobile: { [Op.like]: `%${s}%` } },
        { currentCity: { [Op.like]: `%${s}%` } }
      ];
      if (personWhere[Op.or]) {
        personWhere[Op.and] = [{ [Op.or]: personWhere[Op.or] }, { [Op.or]: sCond }];
        delete personWhere[Op.or];
      } else {
        personWhere[Op.or] = sCond;
      }
    }
  }

  const voterIncludeWhere = voterStatus ? { status: voterStatus } : undefined;

  if (type === 'houses') {
    return House.findAll({
      where: areaFilter,
      include: [
        { model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] },
        { model: Apartment, as: 'apartment', attributes: ['id', 'name'] }
      ],
      order: [['houseNumber', 'ASC']]
    });
  }

  if (type === 'families') {
    return Family.findAll({
      include: [
        houseInclude,
        { model: Person, as: 'members', where: { status: 'ACTIVE' }, required: false }
      ],
      order: [['familyName', 'ASC']]
    });
  }

  if (type === 'shops') {
    return Shop.findAll({
      where: areaFilter,
      include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }],
      order: [['name', 'ASC']]
    });
  }

  if (['persons', 'citizens', 'outOfCity', 'out-of-city', 'retiredPersons'].includes(type)) {
    return Person.findAll({
      where: personWhere,
      include: [
        { model: VoterProfile, as: 'voterProfile', where: voterIncludeWhere, required: Boolean(voterStatus) },
        { model: Family, as: 'family', required: true, include: [houseInclude] }
      ],
      order: [['fullName', 'ASC']]
    });
  }

  if (['voters', 'votersOnly', 'voters-only', 'voter', 'nonVoters', 'non-voters', 'nonVoter', 'non-voter', 'outOfCityVoters', 'out-of-city-voters'].includes(type)) {
    return VoterProfile.findAll({
      where: voterStatus ? { status: voterStatus } : { status: { [Op.in]: ['VOTER', 'NON_VOTER', 'NOT_SPECIFIED'] } },
      include: [{
        model: Person,
        as: 'Person',
        where: personWhere,
        required: true,
        include: [{ model: Family, as: 'family', required: true, include: [houseInclude] }]
      }],
      order: [[{ model: Person, as: 'Person' }, 'fullName', 'ASC']]
    });
  }

  if (type === 'birthdays') {
    const days = Math.max(Number(req.query.days) || 90, 1);
    const now = new Date();
    const pairs = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      pairs.push({ birthMonth: d.getMonth() + 1, birthDay: d.getDate() });
    }
    const bdayWhere = { status: 'ACTIVE', [Op.or]: pairs };
    const bdayRows = await PersonBirthday.findAll({
      where: bdayWhere,
      attributes: ['personId', 'dob', 'fullName', 'birthMonth', 'birthDay']
    }).catch(() => []);
    const personIds = bdayRows.map(r => r.personId).filter(Boolean);
    if (!personIds.length) return [];
    const people = await Person.findAll({
      where: { id: { [Op.in]: personIds }, ...personWhere },
      include: [
        { model: VoterProfile, as: 'voterProfile', required: false },
        { model: Family, as: 'family', required: true, include: [houseInclude] }
      ]
    });
    const byId = new Map(people.map(p => [String(p.id), p]));
    return bdayRows.map(r => byId.get(String(r.personId))).filter(Boolean);
  }

  if (type === 'followup' || type === 'upcoming18') {
    const now = new Date();
    const d18 = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate()).toISOString().slice(0, 10);
    const d18Minus90 = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate() - 90).toISOString().slice(0, 10);
    return Person.findAll({
      where: {
        status: 'ACTIVE',
        dob: { [Op.ne]: null, [Op.gte]: d18Minus90, [Op.lte]: d18 },
        ...personWhere
      },
      include: [
        { model: VoterProfile, as: 'voterProfile', required: false },
        { model: Family, as: 'family', required: true, include: [houseInclude] }
      ],
      order: [['dob', 'DESC']]
    });
  }

  if (type === 'complaints') {
    const complaintWhere = {};
    const cStatus = req.query.status || req.query.complaintStatus;
    if (cStatus && ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(String(cStatus).toUpperCase())) {
      complaintWhere.status = String(cStatus).toUpperCase();
    }
    if (req.query.search) {
      const s = String(req.query.search).trim();
      complaintWhere[Op.or] = [
        { complaintNumber: { [Op.like]: `%${s}%` } },
        { description: { [Op.like]: `%${s}%` } }
      ];
    }
    return Complaint.findAll({
      where: complaintWhere,
      include: [
        { model: Person, as: 'citizen', attributes: ['fullName', 'mobile'] },
        { ...houseInclude }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  if (type === 'wards') {
    const wardWhere = requestedWard ? { id: requestedWard } : {};
    return Ward.findAll({
      where: wardWhere,
      include: [{ model: Area, as: 'areas' }],
      order: [['wardNumber', 'ASC']]
    });
  }

  throw new ApiError(400, 'Unsupported export type');
}

const ALL_DATA_TYPES = ['citizens', 'families', 'houses', 'shops', 'complaints', 'wards'];
const ALL_REPORT_TYPES = [
  'citizens', 'voters', 'nonVoters', 'retiredPersons', 'outOfCity', 'outOfCityVoters',
  'families', 'houses', 'shops', 'birthdays', 'followup', 'complaints', 'wards',
];
const SHEET_TITLES = {
  citizens: 'Citizens',
  voters: 'Voters',
  nonVoters: 'Non-voters',
  retiredPersons: 'Retired',
  outOfCity: 'Out of city',
  outOfCityVoters: 'Out of city voters',
  families: 'Families',
  houses: 'Houses',
  shops: 'Shops & offices',
  birthdays: 'Birthdays',
  followup: '18+ follow-up',
  complaints: 'Complaints',
  wards: 'Wards & areas',
};

function expandExportTypes(type) {
  const key = String(type || '').trim();
  if (key === 'all' || key === 'all-data' || key === 'allData') return ALL_DATA_TYPES;
  if (key === 'all-reports' || key === 'allReports') return ALL_REPORT_TYPES;
  return [key];
}

async function countFor(type, req) {
  const { requestedWard, areaIds } = await resolveAreaIds(req);
  const areaFilter = areaIds ? { areaId: { [Op.in]: areaIds.length ? areaIds : ['00000000-0000-0000-0000-000000000000'] } } : {};
  const houseInclude = {
    model: House,
    as: 'house',
    where: areaFilter,
    required: Boolean(areaIds)
  };

  const presence = presenceWhere(req, type);
  const voterStatus = voterWhere(req, type);
  const gender = genderWhere(req);
  const dobCond = getDobCondition(req);

  const personWhere = { status: 'ACTIVE' };
  if (presence) personWhere.presenceStatus = presence;
  if (gender) personWhere.gender = gender;
  if (dobCond) personWhere.dob = dobCond;
  if (type === 'retiredPersons' || req.query.isRetired === 'true') {
    personWhere[Op.or] = [{ isRetired: true }, { occupationType: 'RETIRED' }];
  }
  const voterIncludeWhere = voterStatus ? { status: voterStatus } : undefined;

  if (type === 'houses') return House.count({ where: areaFilter });
  if (type === 'families') return Family.count({ include: [houseInclude] });
  if (type === 'shops') return Shop.count({ where: areaFilter });

  if (['persons', 'citizens', 'outOfCity', 'out-of-city', 'retiredPersons'].includes(type)) {
    return Person.count({
      where: personWhere,
      include: [
        { model: VoterProfile, as: 'voterProfile', where: voterIncludeWhere, required: Boolean(voterStatus) },
        { model: Family, as: 'family', required: true, include: [houseInclude] }
      ],
      distinct: true
    });
  }

  if (['voters', 'votersOnly', 'voters-only', 'voter', 'nonVoters', 'non-voters', 'nonVoter', 'non-voter', 'outOfCityVoters', 'out-of-city-voters'].includes(type)) {
    return VoterProfile.count({
      where: voterStatus ? { status: voterStatus } : { status: { [Op.in]: ['VOTER', 'NON_VOTER', 'NOT_SPECIFIED'] } },
      include: [{
        model: Person,
        as: 'Person',
        where: personWhere,
        required: true,
        include: [{ model: Family, as: 'family', required: true, include: [houseInclude] }]
      }],
      distinct: true
    });
  }

  if (type === 'complaints') {
    const complaintWhere = {};
    const cStatus = req.query.status || req.query.complaintStatus;
    if (cStatus && ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(String(cStatus).toUpperCase())) {
      complaintWhere.status = String(cStatus).toUpperCase();
    }
    return Complaint.count({ where: complaintWhere, include: [houseInclude] });
  }

  if (type === 'wards') {
    return Ward.count({ where: requestedWard ? { id: requestedWard } : {} });
  }

  const rows = await rowsFor(type, req);
  return rows.length;
}

function presenceLabel(status) {
  if (status === 'OUT_OF_CITY') return 'Out of city (गावाबाहेर)';
  if (status === 'AT_HOME') return 'At house (घरी उपस्थित)';
  return '';
}

function flat(type, r) {
  const x = r.toJSON ? r.toJSON() : r;
  const kind = ['outOfCity', 'out-of-city', 'outOfCityVoters', 'out-of-city-voters'].includes(type)
    ? 'citizens'
    : (['votersOnly', 'voters-only', 'voter', 'nonVoters', 'non-voters', 'nonVoter', 'non-voter'].includes(type) ? 'voters' : type);

  if (kind === 'houses') {
    return {
      'House No': x.houseNumber,
      'Address': x.address,
      'Landmark': x.landmark || '',
      'City': x.city || x.area?.city || '',
      'Pincode': x.pincode || x.area?.pincode || '',
      'Colony': x.area?.name || '',
      'Ward': formatWardNumber(x.area?.ward?.wardNumber) || x.area?.ward?.wardNumber || '',
      'Owner': x.ownerName || '',
      'Mobile': x.ownerMobile || '',
      'Ownership': x.ownership || '',
      'House Type': x.houseType || '',
      'Apartment': x.apartment?.name || '',
      'Latitude': x.latitude || '',
      'Longitude': x.longitude || '',
      'Status': x.status || ''
    };
  }

  if (kind === 'families') {
    return {
      'Family': x.familyName,
      'House No': x.house?.houseNumber || '',
      'Apartment': x.house?.apartment?.name || '',
      'Address': x.house?.address || '',
      'Colony': x.house?.area?.name || '',
      'Ward': formatWardNumber(x.house?.area?.ward?.wardNumber) || '',
      'Total Members': (x.members || []).length,
      'Native Village': x.nativeVillage || '',
      'Native Taluka': x.nativeTaluka || '',
      'Native District': x.nativeDistrict || '',
      'Native State': x.nativeState || '',
      'Status': x.status || ''
    };
  }

  if (kind === 'shops') {
    return {
      'Shop / Office Name': x.name,
      'Type': x.kind === 'OFFICE' ? 'Office' : 'Shop',
      'Category': x.category || '',
      'Ownership': x.ownership || '',
      'Owner': x.ownerName || '',
      'Mobile': x.ownerMobile || '',
      'Address': x.address || '',
      'Landmark': x.landmark || '',
      'Colony': x.area?.name || '',
      'Ward': formatWardNumber(x.area?.ward?.wardNumber) || '',
      'Status': x.status || ''
    };
  }

  if (kind === 'retiredPersons') {
    return {
      'Name': x.fullName,
      'Gender': x.gender === 'MALE' ? 'Male (पुरुष)' : x.gender === 'FEMALE' ? 'Female (स्त्री)' : (x.gender || ''),
      'Age': x.age ?? '',
      'Mobile': x.mobile || '',
      'Status': 'Retired (निवृत्त नागरिक)',
      'Retired From': x.retiredFrom || '—',
      'Designation / Service': x.retiredService || '—',
      'Family': x.family?.familyName || '',
      'House No': x.family?.house?.houseNumber || '',
      'Address': x.family?.house?.address || '',
      'Colony': x.family?.house?.area?.name || '',
      'Ward': formatWardNumber(x.family?.house?.area?.ward?.wardNumber) || '',
      'Voter Status': x.voterProfile?.status || 'Not specified'
    };
  }

  if (kind === 'persons' || kind === 'citizens') {
    return {
      'Name': x.fullName,
      'Gender': x.gender === 'MALE' ? 'Male (पुरुष)' : x.gender === 'FEMALE' ? 'Female (स्त्री)' : (x.gender || ''),
      'DOB': x.dob || '',
      'Age': x.age ?? '',
      'Mobile': x.mobile || '',
      'Alternate Mobile': x.alternateMobile || '',
      'Where Now': presenceLabel(x.presenceStatus),
      'Current City': x.currentCity || '',
      'Living With': x.livingWith || '',
      'Occupation': x.isRetired || x.occupationType === 'RETIRED' ? 'Retired' : (x.occupationType || x.occupation || ''),
      'Company / Business': x.companyName || x.businessName || '',
      'Voter Status': x.voterProfile?.status || 'Not specified',
      'Voting Ward': formatWardNumber(x.voterProfile?.votingWard) || x.voterProfile?.votingWard || '',
      'Voter ID Card': x.voterProfile?.officialVoterIdRef || '',
      'Family': x.family?.familyName || '',
      'House No': x.family?.house?.houseNumber || '',
      'Address': x.family?.house?.address || '',
      'Colony': x.family?.house?.area?.name || '',
      'Ward': formatWardNumber(x.family?.house?.area?.ward?.wardNumber) || '',
      'Status': x.status || ''
    };
  }

  if (kind === 'voters') {
    const p = x.Person || {};
    return {
      'Name': p.fullName || '',
      'Gender': p.gender === 'MALE' ? 'Male (पुरुष)' : p.gender === 'FEMALE' ? 'Female (स्त्री)' : (p.gender || ''),
      'DOB': p.dob || '',
      'Age': p.age ?? '',
      'Mobile': p.mobile || '',
      'Where Now': presenceLabel(p.presenceStatus),
      'Current City': p.currentCity || '',
      'Family': p.family?.familyName || '',
      'House No': p.family?.house?.houseNumber || '',
      'Colony': p.family?.house?.area?.name || '',
      'Resident Ward': formatWardNumber(p.family?.house?.area?.ward?.wardNumber) || '',
      'Voter Status': x.status === 'VOTER' ? 'Voter (मतदार)' : x.status === 'NON_VOTER' ? 'Non-Voter (अमतदार)' : 'Not Specified',
      'Voting Ward': formatWardNumber(x.votingWard) || x.votingWard || '',
      'Voter ID Card': x.officialVoterIdRef || '',
      'Constituency': x.constituency || '',
      'Polling Station': x.voterCenter || '',
      'Room / Booth': x.voterRoom || '',
      'Notes': x.notes || ''
    };
  }

  if (kind === 'birthdays') {
    return {
      'Name': x.fullName,
      'DOB': x.dob || '',
      'Age': x.age ?? '',
      'Mobile': x.mobile || '',
      'Family': x.family?.familyName || '',
      'House No': x.family?.house?.houseNumber || '',
      'Colony': x.family?.house?.area?.name || '',
      'Ward': formatWardNumber(x.family?.house?.area?.ward?.wardNumber) || ''
    };
  }

  if (kind === 'followup' || kind === 'upcoming18') {
    return {
      'Name': x.fullName,
      'DOB': x.dob || '',
      'Age': x.age ?? '',
      'Mobile': x.mobile || '',
      'Follow-up Status': x.followupStatus || 'NOT_CONTACTED',
      'Family': x.family?.familyName || '',
      'House No': x.family?.house?.houseNumber || '',
      'Colony': x.family?.house?.area?.name || '',
      'Ward': formatWardNumber(x.family?.house?.area?.ward?.wardNumber) || ''
    };
  }

  if (kind === 'complaints') {
    return {
      'Complaint No': x.complaintNumber,
      'Status': x.status,
      'Category': x.category || '',
      'Ward': formatWardNumber(x.house?.area?.ward?.wardNumber) || '',
      'Colony': x.house?.area?.name || '',
      'House No': x.house?.houseNumber || '',
      'Citizen Name': x.citizen?.fullName || '',
      'Citizen Mobile': x.citizen?.mobile || '',
      'Description': x.description || '',
      'Date': x.createdAt ? new Date(x.createdAt).toLocaleDateString('en-IN') : ''
    };
  }

  if (kind === 'wards') {
    return {
      'Ward': formatWardNumber(x.wardNumber) || x.wardNumber,
      'Ward Name': x.name,
      'Colonies Count': (x.areas || []).length,
      'Colonies': (x.areas || []).map(a => a.name).join(', ')
    };
  }

  return x;
}

function excelColWidth(key, rows) {
  const k = String(key);
  if (/^Age$/i.test(k)) return 8;
  if (/Ward$/i.test(k) || /Voting Ward/i.test(k)) return 10;
  if (/House No|Pincode|Status|Type|Gender/i.test(k)) return 14;
  if (/Mobile|Phone/i.test(k)) return 14;
  if (/DOB|Date/i.test(k)) return 14;
  if (/Name|Family|Owner|Citizen/i.test(k)) return 28;
  if (/Address|Description|Colonies|Landmark/i.test(k)) return 36;
  if (/Occupation|Company|Relative|Constituency|Polling/i.test(k)) return 22;
  let max = k.length;
  for (const row of rows.slice(0, 60)) {
    max = Math.max(max, String(row?.[k] ?? '').length);
  }
  return Math.min(40, Math.max(12, max + 2));
}

function excelAlign(key) {
  if (/Age|Count|Latitude|Longitude|Pincode|Total Members/i.test(key)) return { horizontal: 'center', vertical: 'middle', wrapText: true };
  if (/Mobile|Ward|House No|Status|Gender|Type|DOB|Date/i.test(key)) return { horizontal: 'center', vertical: 'middle', wrapText: true };
  return { horizontal: 'left', vertical: 'middle', wrapText: true };
}

function displayCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

async function writeSheet(workbook, type, rows) {
  const name = (SHEET_TITLES[type] || type).slice(0, 31);
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    worksheet.columns = keys.map(k => ({
      header: k,
      key: k,
      width: excelColWidth(k, rows),
      style: { alignment: excelAlign(k), font: { size: 10, name: 'Calibri' } }
    }));
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.height = 26;
    headerRow.commit();
    let i = 0;
    for (const row of rows) {
      i += 1;
      const clean = {};
      for (const k of keys) clean[k] = displayCell(row[k]);
      const added = worksheet.addRow(clean);
      added.height = 20;
      added.alignment = { vertical: 'middle', wrapText: true };
      if (i % 2 === 0) {
        added.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      added.commit();
    }
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: keys.length }
    };
  } else {
    worksheet.columns = [{ header: 'Notice', key: 'notice', width: 56 }];
    worksheet.addRow({ notice: 'No matching records found for the selected criteria.' }).commit();
  }
  worksheet.commit();
}

const exportData = asyncHandler(async (req, res) => {
  if (!req.user.permissions.includes('EXPORT_DATA')) {
    throw new ApiError(403, 'Export permission is required');
  }
  const type = req.params.type;
  const format = (req.query.format || 'xlsx').toLowerCase();
  const types = expandExportTypes(type);
  if (types.length > 1 && format === 'pdf') {
    throw new ApiError(400, 'Combined export is available as Excel. Choose one report type for PDF.');
  }

  if (format === 'json') {
    if (types.length === 1) {
      const rows = (await rowsFor(types[0], req)).map(r => flat(types[0], r));
      return res.json({ success: true, count: rows.length, data: rows });
    }
    const data = {};
    const breakdown = {};
    let total = 0;
    for (const t of types) {
      const rows = (await rowsFor(t, req)).map(r => flat(t, r));
      data[t] = rows;
      breakdown[t] = rows.length;
      total += rows.length;
    }
    return res.json({ success: true, count: total, breakdown, types, data });
  }

  if (format === 'xlsx') {
    const fileLabel = types.length > 1 ? (type === 'all-reports' || type === 'allReports' ? 'all-reports' : 'all-data') : types[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ward-${fileLabel}-${Date.now()}.xlsx"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true
    });

    for (const t of types) {
      const rows = (await rowsFor(t, req)).map(r => flat(t, r));
      await writeSheet(workbook, t, rows);
    }

    await workbook.commit();
    return;
  }

  if (format === 'pdf') {
    const rows = (await rowsFor(types[0], req)).map(r => flat(types[0], r));
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ward-${types[0]}-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).text(`Ward Management System - ${SHEET_TITLES[types[0]] || types[0]}`, { underline: true });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString('en-IN')} | Total Records: ${rows.length}`);
    doc.moveDown();
    const printRows = rows.slice(0, 1000);
    printRows.forEach((row, i) => {
      doc.fontSize(8).text(`${i + 1}. ${Object.entries(row).map(([k, v]) => `${k}: ${v ?? '—'}`).join(' | ')}`);
      doc.moveDown(0.25);
    });
    if (rows.length > 1000) {
      doc.moveDown();
      doc.fontSize(9).fillColor('red').text(`* Notice: Showing first 1,000 of ${rows.length} records. Please export Excel (.xlsx) for full dataset.`, { italic: true });
    }
    doc.end();
    return;
  }

  throw new ApiError(400, 'Format must be xlsx, pdf, or json');
});

const exportCount = asyncHandler(async (req, res) => {
  if (!req.user.permissions.includes('EXPORT_DATA')) {
    throw new ApiError(403, 'Export permission is required');
  }
  const type = req.params.type;
  const types = expandExportTypes(type);
  if (types.length === 1) {
    const count = await countFor(types[0], req);
    return res.json({ success: true, count, types });
  }
  const pairs = await Promise.all(types.map(async (t) => [t, await countFor(t, req)]));
  const breakdown = {};
  let count = 0;
  for (const [t, n] of pairs) {
    breakdown[t] = n;
    count += n;
  }
  return res.json({ success: true, count, breakdown, types });
});

module.exports = { exportData, exportCount };
