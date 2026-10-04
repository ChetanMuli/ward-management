'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    const tables = (await queryInterface.showAllTables()).map((t) => String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase());

    if (!tables.includes('ward_portal_configs')) {
      await queryInterface.createTable('ward_portal_configs', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        ward_id: { type: DataTypes.UUID, allowNull: true },
        hero_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        hero_title_en: { type: DataTypes.STRING(255), allowNull: true },
        hero_title_mr: { type: DataTypes.STRING(255), allowNull: true },
        hero_subtitle_en: { type: DataTypes.TEXT, allowNull: true },
        hero_subtitle_mr: { type: DataTypes.TEXT, allowNull: true },
        hero_badge_en: { type: DataTypes.STRING(255), allowNull: true },
        hero_badge_mr: { type: DataTypes.STRING(255), allowNull: true },
        cta_primary_text_en: { type: DataTypes.STRING(100), allowNull: true },
        cta_primary_text_mr: { type: DataTypes.STRING(100), allowNull: true },
        cta_primary_link: { type: DataTypes.STRING(255), allowNull: true },
        cta_secondary_text_en: { type: DataTypes.STRING(100), allowNull: true },
        cta_secondary_text_mr: { type: DataTypes.STRING(100), allowNull: true },
        cta_secondary_link: { type: DataTypes.STRING(255), allowNull: true },
        show_gallery_preview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        minimal_work_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
        featured_nagarsevak_user_id: { type: DataTypes.UUID, allowNull: true },
        meta: { type: DataTypes.JSON, allowNull: true },
        updated_by: { type: DataTypes.UUID, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_portal_configs', ['ward_id'], { name: 'idx_portal_config_ward' });
    } else {
      const desc = await queryInterface.describeTable('ward_portal_configs');
      if (!desc.featured_nagarsevak_user_id) {
        await queryInterface.addColumn('ward_portal_configs', 'featured_nagarsevak_user_id', {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }
    }

    if (!tables.includes('ward_gallery_items')) {
      await queryInterface.createTable('ward_gallery_items', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        ward_id: { type: DataTypes.UUID, allowNull: true },
        nagarsevak_user_id: { type: DataTypes.UUID, allowNull: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        title_mr: { type: DataTypes.STRING(255), allowNull: true },
        category: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'DEVELOPMENT' },
        category_label: { type: DataTypes.STRING(100), allowNull: true },
        category_label_mr: { type: DataTypes.STRING(100), allowNull: true },
        media_type: { type: DataTypes.ENUM('image', 'video'), allowNull: false, defaultValue: 'image' },
        media_url: { type: DataTypes.TEXT('long'), allowNull: false },
        video_url: { type: DataTypes.TEXT, allowNull: true },
        duration: { type: DataTypes.STRING(50), allowNull: true },
        date: { type: DataTypes.STRING(50), allowNull: true },
        date_formatted: { type: DataTypes.STRING(100), allowNull: true },
        date_formatted_mr: { type: DataTypes.STRING(100), allowNull: true },
        location: { type: DataTypes.STRING(255), allowNull: true },
        badge: { type: DataTypes.STRING(100), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        description_mr: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.ENUM('PUBLISHED', 'DRAFT'), allowNull: false, defaultValue: 'PUBLISHED' },
        order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        show_on_dashboard: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_gallery_items', ['ward_id', 'status']);
    }
  },

  async down() {},
};
