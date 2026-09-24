const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NagarsevakSchedule = sequelize.define('NagarsevakSchedule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nagarsevakUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'nagarsevak_user_id',
  },
  createdByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'created_by_user_id',
  },
  wardId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'ward_id',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'scheduled_date',
  },
  scheduledTime: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'scheduled_time',
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  category: {
    type: DataTypes.ENUM('VISIT', 'MEETING', 'INSPECTION', 'EVENT', 'CITIZEN_HEARING', 'OTHER'),
    allowNull: false,
    defaultValue: 'VISIT',
  },
  priority: {
    type: DataTypes.ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW'),
    allowNull: false,
    defaultValue: 'MEDIUM',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at',
  },
  completedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'completed_by_user_id',
  },
  assignedEmployeeUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'assigned_employee_user_id',
  },
  assignedToType: {
    type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE'),
    allowNull: false,
    defaultValue: 'NAGARSEVAK',
    field: 'assigned_to_type',
  },
  completionNote: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'completion_note',
  },
}, {
  tableName: 'nagarsevak_schedules',
  paranoid: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
});

module.exports = NagarsevakSchedule;
