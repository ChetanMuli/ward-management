'use strict';

module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('shops','shops_and_offices')"
    );
    const names = (rows || []).map((r) => r.table_name || r.TABLE_NAME);
    if (names.includes('shops_and_offices')) return;
    if (!names.includes('shops')) return;
    await queryInterface.renameTable('shops', 'shops_and_offices');
    await queryInterface.sequelize.query(
      "ALTER TABLE shops_and_offices COMMENT = 'Shops and offices registered in each colony'"
    );
  },

  async down(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('shops','shops_and_offices')"
    );
    const names = (rows || []).map((r) => r.table_name || r.TABLE_NAME);
    if (names.includes('shops') || !names.includes('shops_and_offices')) return;
    await queryInterface.renameTable('shops_and_offices', 'shops');
  },
};
