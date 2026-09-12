const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Family = sequelize.define('Family', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  houseId: { type: DataTypes.UUID, allowNull: false },
  familyName: { type: DataTypes.STRING, allowNull: true },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MOVED_OUT'),
    defaultValue: 'ACTIVE',
  },
  notes: DataTypes.TEXT,
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'families',
  indexes: [{ fields: ['house_id'] }],
});

module.exports = Family;
