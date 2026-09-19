const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apartment = sequelize.define('Apartment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false },
  areaId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  address: DataTypes.TEXT,
  landmark: DataTypes.STRING,
  floors: DataTypes.INTEGER,
  notes: DataTypes.TEXT,
  latitude: DataTypes.DECIMAL(10, 7),
  longitude: DataTypes.DECIMAL(10, 7),
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'apartments',
});

module.exports = Apartment;
