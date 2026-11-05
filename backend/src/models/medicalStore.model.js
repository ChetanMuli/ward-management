const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MedicalStore = sequelize.define('MedicalStore', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  areaId: { type: DataTypes.UUID, allowNull: true, field: 'area_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  type: {
    type: DataTypes.ENUM('ALLOPATHIC', 'AYURVEDIC', 'HOMOEOPATHIC', 'GENERIC', 'WHOLESALE_RETAIL', 'OTHER'),
    allowNull: false,
    defaultValue: 'ALLOPATHIC',
  },
  address: { type: DataTypes.TEXT, allowNull: true },
  landmark: DataTypes.STRING,
  phone: DataTypes.STRING,
  emergencyPhone: { type: DataTypes.STRING, field: 'emergency_phone' },
  openingHours: { type: DataTypes.STRING, field: 'opening_hours' },
  is24x7: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_24x7' },
  homeDelivery: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'home_delivery' },
  facilities: DataTypes.TEXT,
  latitude: DataTypes.DECIMAL(10, 7),
  longitude: DataTypes.DECIMAL(10, 7),
  notes: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
  createdByUserId: { type: DataTypes.UUID, allowNull: true, field: 'created_by_user_id' },
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  underscored: true,
  tableName: 'medical_stores',
  comment: 'Medical stores, pharmacies and chemists in municipal wards',
  indexes: [
    { name: 'idx_medicals_ward_status_del', fields: ['ward_id', 'status', 'deleted_at'] },
    { name: 'idx_medicals_ward_24x7', fields: ['ward_id', 'is_24x7', 'status'] },
    { name: 'idx_medicals_area_status_del', fields: ['area_id', 'status', 'deleted_at'] },
    { name: 'idx_medicals_name', fields: ['name'] },
    { name: 'idx_medicals_phone', fields: ['phone'] },
    { name: 'idx_medicals_deleted', fields: ['deleted_at'] },
  ],
});

module.exports = MedicalStore;
