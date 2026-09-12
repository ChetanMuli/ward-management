const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: true }, // null for system/automated jobs
  role: DataTypes.STRING,
  action: { type: DataTypes.STRING, allowNull: false }, // e.g. 'CREATE_PERSON', 'EXPORT_REPORT'
  entity: { type: DataTypes.STRING, allowNull: false }, // e.g. 'Person', 'Complaint'
  recordId: DataTypes.UUID,
  oldValue: DataTypes.JSON,
  newValue: DataTypes.JSON,
  ipAddress: DataTypes.STRING,
}, {
  tableName: 'audit_logs',
  updatedAt: false, // append-only, immutable
  indexes: [
    { fields: ['entity', 'record_id'] },
    { fields: ['user_id'] },
    { fields: ['created_at'] },
  ],
});

module.exports = AuditLog;
