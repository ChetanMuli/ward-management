const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Scheme = sequelize.define('Scheme', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  benefits: { type: DataTypes.TEXT, allowNull: true },
  eligibility: { type: DataTypes.TEXT, allowNull: true },
  minAge: { type: DataTypes.INTEGER, allowNull: true },
  maxAge: { type: DataTypes.INTEGER, allowNull: true },
  gender: { type: DataTypes.ENUM('ALL','FEMALE','MALE','OTHER'), allowNull: false, defaultValue: 'ALL' },
  audience: { type: DataTypes.STRING(120), allowNull: true },
  wardId: { type: DataTypes.UUID, allowNull: true },
  applicationUrl: { type: DataTypes.STRING(500), allowNull: true },
  contactInfo: { type: DataTypes.STRING(500), allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM('DRAFT','PUBLISHED','CLOSED'), allowNull: false, defaultValue: 'PUBLISHED' },
  createdByUserId: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'schemes' });

module.exports = Scheme;
