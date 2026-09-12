const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Area = sequelize.define('Area', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
}, { paranoid: true, deletedAt: 'deletedAt', tableName: 'areas' });

module.exports = Area;
