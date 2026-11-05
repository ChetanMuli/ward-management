'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    const tables = (await queryInterface.showAllTables()).map((t) =>
      String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase()
    );

    if (tables.includes('ward_nagarsevak_subscriptions')) {
      const desc = await queryInterface.describeTable('ward_nagarsevak_subscriptions');
      if (!desc.resident_visible) {
        await queryInterface.addColumn('ward_nagarsevak_subscriptions', 'resident_visible', {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
        await queryInterface.sequelize.query(
          "UPDATE ward_nagarsevak_subscriptions SET resident_visible = 1 WHERE status = 'ACTIVE'"
        );
      }
    }

    if (tables.includes('ward_gallery_items')) {
      const desc = await queryInterface.describeTable('ward_gallery_items');
      if (!desc.nagarsevak_user_id) {
        await queryInterface.addColumn('ward_gallery_items', 'nagarsevak_user_id', {
          type: DataTypes.UUID,
          allowNull: true,
        });
      }
    }

    if (tables.includes('ward_portal_configs')) {
      await queryInterface.sequelize.query(`
        UPDATE ward_portal_configs
        SET meta = CAST(JSON_UNQUOTE(meta) AS JSON)
        WHERE meta IS NOT NULL AND JSON_TYPE(meta) = 'STRING'
      `).catch(() => {});
    }
  },

  async down() {},
};
