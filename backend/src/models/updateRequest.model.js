const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UpdateRequest = sequelize.define('UpdateRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  personId: { type: DataTypes.UUID, allowNull: false },
  requestedByUserId: { type: DataTypes.UUID, allowNull: false },
  fieldName: { type: DataTypes.STRING, allowNull: false },
  currentValue: DataTypes.TEXT,
  requestedValue: { type: DataTypes.TEXT, allowNull: false },
  reason: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'PENDING',
  },
  reviewedBy: DataTypes.UUID,
  reviewedAt: DataTypes.DATE,
  reviewNote: DataTypes.TEXT,
}, { tableName: 'update_requests' });

module.exports = UpdateRequest;
