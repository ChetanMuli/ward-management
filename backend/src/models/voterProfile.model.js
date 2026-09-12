const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VoterProfile = sequelize.define('VoterProfile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  personId: { type: DataTypes.UUID, allowNull: false, unique: true },
  status: {
    type: DataTypes.ENUM(
      'VOTER',
      'NON_VOTER',
      'NOT_SPECIFIED',
      'DECEASED',
      'MOVED_OUT'
    ),
    defaultValue: 'NOT_SPECIFIED',
  },
  constituency: DataTypes.STRING,
  votingWard: DataTypes.STRING,
  voterCenter: { type: DataTypes.STRING(300), allowNull: true },
  voterRoom: { type: DataTypes.STRING(120), allowNull: true },
  // NOTE: this table is an internal operational tracking layer only.
  // It must never be used to write to, delete, or otherwise alter any
  // official electoral roll record.
  officialVoterIdRef: { type: DataTypes.STRING, allowNull: true },
  verifiedBy: DataTypes.UUID,
  verifiedAt: DataTypes.DATE,
  notes: DataTypes.TEXT,
}, { paranoid: true, deletedAt: 'deletedAt', tableName: 'voter_profiles' });

module.exports = VoterProfile;
