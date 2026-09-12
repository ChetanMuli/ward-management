const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeathRecord = sequelize.define('DeathRecord', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  personId: { type: DataTypes.UUID, allowNull: false, unique: true },
  dateOfDeath: { type: DataTypes.DATEONLY, allowNull: false },
  reportedBy: { type: DataTypes.UUID, allowNull: false },
  verificationStatus: {
    type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
    defaultValue: 'VERIFIED',
  },
  previousVoterStatus: {
    type: DataTypes.ENUM('VOTER', 'NON_VOTER', 'NOT_SPECIFIED', 'DECEASED'),
    allowNull: true,
    field: 'previous_voter_status',
  },
  recordStatus: {
    type: DataTypes.ENUM('ACTIVE', 'RESTORED'),
    allowNull: false,
    defaultValue: 'ACTIVE',
    field: 'record_status',
  },
  restoredBy: { type: DataTypes.UUID, allowNull: true, field: 'restored_by' },
  restoredAt: { type: DataTypes.DATE, allowNull: true, field: 'restored_at' },
  documentRef: DataTypes.STRING, // pointer to Attachment/S3 key, not the file itself
  notes: DataTypes.TEXT,
  verifiedBy: DataTypes.UUID,
  verifiedAt: DataTypes.DATE,
}, { tableName: 'death_records' });

module.exports = DeathRecord;
