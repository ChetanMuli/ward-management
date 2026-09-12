const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  wardId: { type: DataTypes.UUID, allowNull: true },
  managerUserId: { type: DataTypes.UUID, allowNull: true },
  designation: DataTypes.STRING,
  assignedAreaIds: { type: DataTypes.JSON, defaultValue: [] },
  permissions: { type: DataTypes.JSON, defaultValue: [] },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
}, { tableName: 'employees' });

module.exports = Employee;
