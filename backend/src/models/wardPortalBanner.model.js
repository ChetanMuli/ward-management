const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardPortalBanner = sequelize.define('WardPortalBanner', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  homeBannerUrl: { type: DataTypes.TEXT('long'), allowNull: true, field: 'home_banner_url' },
  complaintsBannerUrl: { type: DataTypes.TEXT('long'), allowNull: true, field: 'complaints_banner_url' },
  galleryBannerUrl: { type: DataTypes.TEXT('long'), allowNull: true, field: 'gallery_banner_url' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
}, {
  tableName: 'ward_portal_banners',
  underscored: true,
  timestamps: true,
});

module.exports = WardPortalBanner;
