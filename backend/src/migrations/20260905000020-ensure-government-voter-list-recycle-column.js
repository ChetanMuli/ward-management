'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map(String).map(x => x.toLowerCase());
    if (!names.includes('government_voter_lists')) return;
    const d = await queryInterface.describeTable('government_voter_lists');
    if (!d.deleted_at) {
      await queryInterface.addColumn('government_voter_lists', 'deleted_at', { type: Sequelize.DATE, allowNull: true });
    }
    await queryInterface.addIndex('government_voter_lists', ['deleted_at']).catch(() => {});
  },
  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map(String).map(x => x.toLowerCase());
    if (!names.includes('government_voter_lists')) return;
    const d = await queryInterface.describeTable('government_voter_lists');
    if (d.deleted_at) await queryInterface.removeColumn('government_voter_lists', 'deleted_at');
  },
};
