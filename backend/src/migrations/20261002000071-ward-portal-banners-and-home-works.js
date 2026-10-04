'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    const tables = (await queryInterface.showAllTables()).map((t) => String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase());

    if (!tables.includes('ward_portal_banners')) {
      await queryInterface.createTable('ward_portal_banners', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        ward_id: { type: DataTypes.UUID, allowNull: false },
        home_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        complaints_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        gallery_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        updated_by: { type: DataTypes.UUID, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_portal_banners', ['ward_id'], { unique: true, name: 'uq_portal_banners_ward' });
    }

    if (!tables.includes('ward_home_works')) {
      await queryInterface.createTable('ward_home_works', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        ward_id: { type: DataTypes.UUID, allowNull: false },
        gallery_item_id: { type: DataTypes.UUID, allowNull: false },
        order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_home_works', ['ward_id', 'order_index'], { name: 'idx_home_works_ward_order' });
      await queryInterface.addIndex('ward_home_works', ['ward_id', 'gallery_item_id'], { unique: true, name: 'uq_home_works_ward_item' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ward_home_works').catch(() => {});
    await queryInterface.dropTable('ward_portal_banners').catch(() => {});
  },
};
