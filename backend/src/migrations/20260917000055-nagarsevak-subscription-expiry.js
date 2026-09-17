'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (!names.includes('ward_nagarsevak_subscriptions')) return;
    const cols = await queryInterface.describeTable('ward_nagarsevak_subscriptions');
    if (!cols.expiry_notified_at) {
      await queryInterface.addColumn('ward_nagarsevak_subscriptions', 'expiry_notified_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (!names.includes('ward_nagarsevak_subscriptions')) return;
    const cols = await queryInterface.describeTable('ward_nagarsevak_subscriptions');
    if (cols.expiry_notified_at) {
      await queryInterface.removeColumn('ward_nagarsevak_subscriptions', 'expiry_notified_at');
    }
  },
};
