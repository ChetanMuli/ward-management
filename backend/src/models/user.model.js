const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, validate: { isEmail: true } },
  mobile: { type: DataTypes.STRING, unique: true },
  passwordHash: { type: DataTypes.VIRTUAL },
  permissions: { type: DataTypes.VIRTUAL },
  // Sub Master Admin can be explicitly limited to one or more wards.
  wardIds: { type: DataTypes.VIRTUAL },
  roleId: { type: DataTypes.UUID, allowNull: false },
  personId: { type: DataTypes.UUID, allowNull: true },
  wardId: { type: DataTypes.UUID, allowNull: true },
  wardSeat: { type: DataTypes.VIRTUAL },
  partyName: { type: DataTypes.VIRTUAL },
  officialAddress: { type: DataTypes.VIRTUAL },
  photo: { type: DataTypes.VIRTUAL },
  accountKind: { type: DataTypes.VIRTUAL },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'),
    defaultValue: 'ACTIVE',
  },
  twoFactorEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastLoginAt: DataTypes.DATE,
}, { tableName: 'users', paranoid: true, deletedAt: 'deletedAt' });

module.exports = User;
