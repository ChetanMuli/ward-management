const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardGalleryItem = sequelize.define('WardGalleryItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: true, field: 'ward_id' },
  nagarsevakUserId: { type: DataTypes.UUID, allowNull: true, field: 'nagarsevak_user_id' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  titleMr: { type: DataTypes.STRING(255), allowNull: true, field: 'title_mr' },
  category: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'DEVELOPMENT' },
  categoryLabel: { type: DataTypes.STRING(100), allowNull: true, field: 'category_label' },
  categoryLabelMr: { type: DataTypes.STRING(100), allowNull: true, field: 'category_label_mr' },
  mediaType: { type: DataTypes.ENUM('image', 'video'), allowNull: false, defaultValue: 'image', field: 'media_type' },
  mediaUrl: { type: DataTypes.TEXT('long'), allowNull: false, field: 'media_url' },
  videoUrl: { type: DataTypes.TEXT, allowNull: true, field: 'video_url' },
  duration: { type: DataTypes.STRING(50), allowNull: true },
  date: { type: DataTypes.STRING(50), allowNull: true },
  dateFormatted: { type: DataTypes.STRING(100), allowNull: true, field: 'date_formatted' },
  dateFormattedMr: { type: DataTypes.STRING(100), allowNull: true, field: 'date_formatted_mr' },
  location: { type: DataTypes.STRING(255), allowNull: true },
  badge: { type: DataTypes.STRING(100), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  descriptionMr: { type: DataTypes.TEXT, allowNull: true, field: 'description_mr' },
  status: { type: DataTypes.ENUM('PUBLISHED', 'DRAFT'), allowNull: false, defaultValue: 'PUBLISHED' },
  orderIndex: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'order_index' },
  showOnDashboard: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'show_on_dashboard' },
}, {
  tableName: 'ward_gallery_items',
  underscored: true,
  timestamps: true,
  paranoid: true,
  deletedAt: 'deleted_at',
});

module.exports = WardGalleryItem;
