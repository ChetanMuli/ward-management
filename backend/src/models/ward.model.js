const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ward = sequelize.define('Ward', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'ward_number',
  },
  name: { type: DataTypes.STRING, allowNull: true },
  description: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'INACTIVE',
  },
  officialMapUrl: {
    type: DataTypes.STRING,
    field: 'official_map_url',
  },
  officialSourceUrl: {
    type: DataTypes.STRING,
    field: 'official_source_url',
  },
  population2011: {
    type: DataTypes.INTEGER,
    field: 'population_2011',
  },
  scPopulation2011: {
    type: DataTypes.INTEGER,
    field: 'sc_population_2011',
  },
  stPopulation2011: {
    type: DataTypes.INTEGER,
    field: 'st_population_2011',
  },
  seatCount: {
    type: DataTypes.INTEGER,
    field: 'seat_count',
  },
  dataSourceNote: {
    type: DataTypes.TEXT,
    field: 'data_source_note',
  },
  city: DataTypes.STRING,
  district: DataTypes.STRING,
  pincode: DataTypes.STRING,
  latitude: DataTypes.DECIMAL(10, 7),
  longitude: DataTypes.DECIMAL(10, 7),
  activatedAt: { type: DataTypes.DATE, allowNull: true, field: 'activated_at' },
  activatedBy: { type: DataTypes.UUID, allowNull: true, field: 'activated_by' },
  deactivatedAt: { type: DataTypes.DATE, allowNull: true, field: 'deactivated_at' },
  deactivatedBy: { type: DataTypes.UUID, allowNull: true, field: 'deactivated_by' },
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'wards',
});

module.exports = Ward;
