const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const House = sequelize.define('House', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  houseNumber: { type: DataTypes.STRING, allowNull: false },
  areaId: { type: DataTypes.UUID, allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: false },
  landmark: DataTypes.STRING,
  city: DataTypes.STRING,
  pincode: DataTypes.STRING,
  houseType: {
    type: DataTypes.ENUM('INDEPENDENT_HOUSE', 'FLAT', 'CHAWL', 'OTHER'),
    defaultValue: 'INDEPENDENT_HOUSE',
  },
  ownership: {
    type: DataTypes.ENUM('OWN', 'RENT', 'OTHER'),
    defaultValue: 'OWN',
  },
  ownerName: DataTypes.STRING,
  ownerMobile: DataTypes.STRING,
  latitude: DataTypes.DECIMAL(10, 7),
  longitude: DataTypes.DECIMAL(10, 7),
  verificationStatus: {
    type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
    defaultValue: 'PENDING',
  },
  assignedEmployeeId: { type: DataTypes.UUID, allowNull: true },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MOVED_REMOVED'),
    defaultValue: 'ACTIVE',
  },
  lastVerifiedAt: DataTypes.DATE,
  notes: DataTypes.TEXT,
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'houses',
  indexes: [
    { fields: ['house_number'] },
    { fields: ['area_id'] },
    { fields: ['status'] },
  ],
});

module.exports = House;
