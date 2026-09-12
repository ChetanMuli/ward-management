const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: {
    type: DataTypes.ENUM('SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE', 'CITIZEN', 'SOCIAL_WORKER', 'CANDIDATE'),
    allowNull: false,
    unique: true,
  },
  description: DataTypes.STRING,
}, { tableName: 'roles' });

module.exports = Role;
