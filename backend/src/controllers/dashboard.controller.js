const { Op, fn, col } = require('sequelize');
const { House, Person, Complaint, Family, VoterProfile, Area, Ward, Employee, User, Role, PersonBirthday } = require('../models');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const wardInclude = (wardId) => ({
  model: Area, as: 'area', required: Boolean(wardId),
  include: [{ model: Ward, as: 'ward', required: Boolean(wardId), ...(wardId ? { where: { id: wardId } } : {}) }]
});

const scopeWard = (req) => {
  if (req.user.roleName === 'SUPER_ADMIN') return req.query.wardId || null;
  return req.user.wardId || req.user.employeeProfile?.wardId || null;
};

const OPEN_STATUSES = ['SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'];

const summary = asyncHandler(async (req, res) => {
  const wardId = scopeWard(req);
  const houseWhere = {};
  const houseInclude = wardId ? [wardInclude(wardId)] : [];
  const familyInclude = wardId ? [{ model: House, as: 'house', required: true, include: [wardInclude(wardId)] }] : [];
  const personInclude = wardId ? [{ model: Family, as: 'family', required: true, include: [{ model: House, as: 'house', required: true, include: [wardInclude(wardId)] }] }] : [];
  const complaintInclude = wardId ? [{ model: House, as: 'house', required: true, include: [wardInclude(wardId)] }] : [];
  const bdayPairs = [];
  const now = new Date();
  for (let i = 0; i <= 30; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    bdayPairs.push({ birthMonth: d.getMonth() + 1, birthDay: d.getDate() });
  }
  const turn18Start = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const turn18End = new Date(turn18Start); turn18End.setDate(turn18End.getDate() + 90);

  const [houses, families, persons, voters, nonVoters, complaintGroups, recent, employees, birthdayCount, upcoming18] = await Promise.all([
    House.count({ where: houseWhere, include: houseInclude }),
    Family.count({ include: familyInclude, distinct: true }),
    Person.count({ where: { status: 'ACTIVE' }, include: personInclude, distinct: true }),
    Person.count({
      where: { status: 'ACTIVE' },
      include: [
        { model: VoterProfile, as: 'voterProfile', required: true, where: { status: 'VOTER' } },
        ...personInclude,
      ],
      distinct: true,
    }),
    Person.count({
      where: { status: 'ACTIVE' },
      include: [
        { model: VoterProfile, as: 'voterProfile', required: true, where: { status: 'NON_VOTER' } },
        ...personInclude,
      ],
      distinct: true,
    }),
    Complaint.findAll({
      attributes: ['status', [fn('COUNT', col('Complaint.id')), 'c']],
      where: wardId ? { wardId } : {},
      group: ['status'],
      raw: true,
    }),
    Complaint.findAll({
      where: {
        ...(wardId ? { wardId } : {}),
        status: { [Op.in]: ['SUBMITTED', 'OPEN', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] },
      },
      limit: 20,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Person, as: 'citizen', attributes: ['fullName', 'mobile'] },
        { model: House, as: 'house', include: [wardInclude(wardId)] },
      ],
    }),
    Employee.count(wardId ? { where: { wardId } } : {}),
    PersonBirthday.count({
      where: { status: 'ACTIVE', ...(wardId ? { wardId } : {}), [Op.or]: bdayPairs },
    }).catch(() => 0),
    Person.count({
      where: { status: 'ACTIVE', dob: { [Op.between]: [turn18Start.toISOString().slice(0, 10), turn18End.toISOString().slice(0, 10)] } },
      include: personInclude,
      distinct: true,
    }),
  ]);

  const complaintsByStatus = {};
  (complaintGroups || []).forEach((row) => {
    complaintsByStatus[row.status] = Number(row.c || 0);
  });
  const ward = wardId ? await Ward.findByPk(wardId, { attributes: ['id', 'wardNumber', 'name'] }) : null;

  return success(res, {
    data: {
      generatedAt: new Date().toISOString(),
      ward,
      houses,
      families,
      persons,
      voters,
      nonVoters,
      openComplaints: OPEN_STATUSES.reduce((n, s) => n + (complaintsByStatus[s] || 0), 0),
      birthdaysNext30: birthdayCount,
      upcoming18Next90: upcoming18,
      complaintStatus: complaintsByStatus,
      statusCounts: complaintsByStatus,
      recentComplaints: recent,
      corporatorCount: await User.count({
        where: { ...(wardId ? { wardId } : {}), status: 'ACTIVE' },
        include: [{ model: Role, where: { name: 'NAGARSEVAK' }, required: true }],
      }),
      managedEmployees: employees,
    },
  });
});
module.exports = { summary };
