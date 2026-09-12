const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const loginStatus = {
  type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'),
  defaultValue: 'ACTIVE',
};

function defineLoginModel(name, tableName, extra = {}) {
  return sequelize.define(name, {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    mobile: { type: DataTypes.STRING },
    passwordHash: { type: DataTypes.STRING },
    status: loginStatus,
    twoFactorEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastLoginAt: DataTypes.DATE,
    wardId: { type: DataTypes.UUID, allowNull: true },
    ...extra,
  }, {
    tableName,
    paranoid: true,
    deletedAt: 'deletedAt',
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['mobile'] },
      { fields: ['status'] },
      { fields: ['ward_id'] },
      { fields: ['status', 'ward_id'] },
    ],
  });
}

const AdminUser = defineLoginModel('AdminUser', 'admin_users');
const SubAdminUser = defineLoginModel('SubAdminUser', 'sub_admin_users', {
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  wardIds: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
});
const NagarsevakUser = defineLoginModel('NagarsevakUser', 'nagarsevak_users', {
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  wardSeat: { type: DataTypes.STRING, allowNull: true, field: 'ward_seat' },
  partyName: { type: DataTypes.STRING, allowNull: true, field: 'party_name' },
  officialAddress: { type: DataTypes.TEXT, allowNull: true, field: 'official_address' },
});
const EmployeeUser = defineLoginModel('EmployeeUser', 'employee_users');
const CitizenUser = defineLoginModel('CitizenUser', 'citizen_users', {
  personId: { type: DataTypes.UUID, allowNull: true },
});
const CommunityUser = defineLoginModel('CommunityUser', 'community_users', {
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  memberRole: {
    type: DataTypes.ENUM('SOCIAL_WORKER', 'CANDIDATE'),
    allowNull: false,
    defaultValue: 'SOCIAL_WORKER',
    field: 'member_role',
  },
});

module.exports = {
  AdminUser,
  SubAdminUser,
  NagarsevakUser,
  EmployeeUser,
  CitizenUser,
  CommunityUser,
};
