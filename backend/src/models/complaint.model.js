const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Complaint = sequelize.define('Complaint', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  complaintNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  citizenPersonId: { type: DataTypes.UUID, allowNull: true },
  houseId: { type: DataTypes.UUID, allowNull: true },
  submittedByUserId: { type: DataTypes.UUID, allowNull: true },
  wardId: { type: DataTypes.UUID, allowNull: true },
  assignedNagarsevakUserId: { type: DataTypes.UUID, allowNull: true },
  location: { type: DataTypes.STRING(500), allowNull: true },
  category: {
    type: DataTypes.ENUM('WATER', 'ROADS', 'STREET_LIGHTS', 'GARBAGE', 'DRAINAGE', 'SANITATION', 'HEALTH', 'OTHER'),
    allowNull: false,
  },
  description: { type: DataTypes.TEXT, allowNull: false },
  attachmentKey: DataTypes.STRING,
  reportedImage: DataTypes.TEXT,
  resolutionImage: DataTypes.TEXT,
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
  },
  status: {
    type: DataTypes.ENUM('SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED'),
    defaultValue: 'SUBMITTED',
  },
  assignedEmployeeId: { type: DataTypes.UUID, allowNull: true },
  slaDueAt: DataTypes.DATE,
  resolutionNote: DataTypes.TEXT,
  resolvedAt: DataTypes.DATE,
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'complaints',
  indexes: [
    { fields: ['status'] },
    { fields: ['priority'] },
    { fields: ['citizen_person_id'] },
    { fields: ['house_id'] },
  ],
});

module.exports = Complaint;
