const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardUpdate = sequelize.define('WardUpdate', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false },
  type: {
    type: DataTypes.ENUM('WARD_UPDATE', 'EVENT'),
    allowNull: false,
    defaultValue: 'WARD_UPDATE',
  },
  title: { type: DataTypes.STRING(180), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  eventDate: { type: DataTypes.DATE, allowNull: true },
  location: { type: DataTypes.STRING(300), allowNull: true },
  audience: {
    type: DataTypes.ENUM('CITIZEN', 'NAGARSEVAK', 'EMPLOYEE', 'ALL_STAFF'),
    allowNull: false,
    defaultValue: 'CITIZEN',
  },
  status: {
    type: DataTypes.ENUM('PUBLISHED', 'ARCHIVED'),
    allowNull: false,
    defaultValue: 'PUBLISHED',
  },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  createdByUserId: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'ward_updates',
});

module.exports = WardUpdate;
