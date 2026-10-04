const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardPortalConfig = sequelize.define('WardPortalConfig', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: true, field: 'ward_id' },
  heroBannerUrl: { type: DataTypes.TEXT('long'), allowNull: true, field: 'hero_banner_url' },
  heroTitleEn: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'Welcome', field: 'hero_title_en' },
  heroTitleMr: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'स्वागत आहे', field: 'hero_title_mr' },
  heroSubtitleEn: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: 'WardDesk is your digital ward desk for complaints, schemes and notices. One secure account keeps you connected to your local ward office.',
    field: 'hero_subtitle_en'
  },
  heroSubtitleMr: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: 'तुमच्या वॉर्डमधील अपडेट्स, कार्यक्रम, योजना आणि तक्रारींची माहिती एका ठिकाणी.',
    field: 'hero_subtitle_mr'
  },
  heroBadgeEn: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'OFFICIAL 24/7 WARD DESK · LIVE', field: 'hero_badge_en' },
  heroBadgeMr: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '२४/७ अधिकृत प्रभाग सेवा कक्ष · थेट सक्रिय', field: 'hero_badge_mr' },
  ctaPrimaryTextEn: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Raise a complaint', field: 'cta_primary_text_en' },
  ctaPrimaryTextMr: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'तक्रार नोंदवा', field: 'cta_primary_text_mr' },
  ctaPrimaryLink: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '/my-complaints', field: 'cta_primary_link' },
  ctaSecondaryTextEn: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'View Work', field: 'cta_secondary_text_en' },
  ctaSecondaryTextMr: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'विकास कामे पहा', field: 'cta_secondary_text_mr' },
  ctaSecondaryLink: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '/gallery', field: 'cta_secondary_link' },
  showGalleryPreview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_gallery_preview' },
  minimalWorkCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2, field: 'minimal_work_count' },
  featuredNagarsevakUserId: { type: DataTypes.UUID, allowNull: true, field: 'featured_nagarsevak_user_id' },
  meta: { type: DataTypes.JSON, allowNull: true },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
}, {
  tableName: 'ward_portal_configs',
  underscored: true,
  timestamps: true,
});

module.exports = WardPortalConfig;
