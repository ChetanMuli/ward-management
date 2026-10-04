const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardHomeWork = sequelize.define('WardHomeWork', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  galleryItemId: { type: DataTypes.UUID, allowNull: false, field: 'gallery_item_id' },
  orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'order_index' },
}, {
  tableName: 'ward_home_works',
  underscored: true,
  timestamps: true,
});

module.exports = WardHomeWork;
