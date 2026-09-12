const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ComplaintHistory = sequelize.define('ComplaintHistory', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  complaintId: { type: DataTypes.UUID, allowNull: false },
  oldStatus: DataTypes.STRING,
  newStatus: { type: DataTypes.STRING, allowNull: false },
  comment: DataTypes.TEXT,
  changedByUserId: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'complaint_histories',
  updatedAt: false, // append-only: no updated_at needed
});

module.exports = ComplaintHistory;
