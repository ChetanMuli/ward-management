const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NagarsevakScheduleAssignment = sequelize.define('NagarsevakScheduleAssignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  scheduleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'schedule_id',
  },
  fromType: {
    type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE', 'UNASSIGNED'),
    allowNull: false,
    field: 'from_type',
  },
  fromUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'from_user_id',
  },
  toType: {
    type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE', 'UNASSIGNED'),
    allowNull: false,
    field: 'to_type',
  },
  toUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'to_user_id',
  },
  assignedByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'assigned_by_user_id',
  },
  note: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'nagarsevak_schedule_assignments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['schedule_id', 'created_at'] },
    { fields: ['to_user_id'] },
    { fields: ['assigned_by_user_id'] },
  ],
});

module.exports = NagarsevakScheduleAssignment;
