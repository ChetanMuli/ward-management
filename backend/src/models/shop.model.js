const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Shop = sequelize.define('Shop', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  areaId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  kind: {
    type: DataTypes.ENUM('SHOP', 'OFFICE'),
    allowNull: false,
    defaultValue: 'SHOP',
  },
  category: DataTypes.STRING,
  address: { type: DataTypes.TEXT, allowNull: false },
  landmark: DataTypes.STRING,
  ownerName: DataTypes.STRING,
  ownerMobile: DataTypes.STRING,
  ownership: {
    type: DataTypes.ENUM('OWN', 'RENT', 'OTHER'),
    allowNull: true,
  },
  gstNumber: DataTypes.STRING,
  licenseNumber: DataTypes.STRING,
  openingHours: DataTypes.STRING,
  latitude: DataTypes.DECIMAL(10, 7),
  longitude: DataTypes.DECIMAL(10, 7),
  notes: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'shops',
  indexes: [
    { fields: ['area_id'] },
    { fields: ['kind'] },
    { fields: ['status'] },
  ],
});

module.exports = Shop;
