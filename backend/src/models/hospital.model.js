const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Hospital = sequelize.define('Hospital', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false },
  areaId: { type: DataTypes.UUID, allowNull: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: {
    type: DataTypes.ENUM('GOVERNMENT', 'PRIVATE', 'TRUST', 'CLINIC', 'PHC', 'AYUSH', 'OTHER'),
    allowNull: false,
    defaultValue: 'PRIVATE',
  },
  address: { type: DataTypes.TEXT, allowNull: true },
  landmark: DataTypes.STRING,
  phone: DataTypes.STRING,
  emergencyPhone: DataTypes.STRING,
  openingHours: DataTypes.STRING,
  facilities: DataTypes.TEXT,
  latitude: DataTypes.DECIMAL(10, 7),
  longitude: DataTypes.DECIMAL(10, 7),
  notes: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
  createdByUserId: { type: DataTypes.UUID, allowNull: true },
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'hospitals',
  comment: 'Hospitals and clinics registered in each municipal ward',
  indexes: [
    { name: 'idx_hospitals_ward_status_del', fields: ['ward_id', 'status', 'deleted_at'] },
    { name: 'idx_hospitals_ward_type_status', fields: ['ward_id', 'type', 'status', 'deleted_at'] },
    { name: 'idx_hospitals_area_status_del', fields: ['area_id', 'status', 'deleted_at'] },
    { name: 'idx_hospitals_name', fields: ['name'] },
    { name: 'idx_hospitals_phone', fields: ['phone'] },
    { name: 'idx_hospitals_deleted', fields: ['deleted_at'] },
  ],
});

module.exports = Hospital;
