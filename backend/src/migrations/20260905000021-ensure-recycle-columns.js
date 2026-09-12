'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map(String).map(x => x.toLowerCase());

    const targets = [
      ['government_voter_lists', 'deleted_at'],
    ];

    for (const [table, column] of targets) {
      if (!names.includes(table)) continue;
      const definition = await queryInterface.describeTable(table);
      if (!definition[column]) {
        await queryInterface.addColumn(table, column, {
          type: Sequelize.DATE,
          allowNull: true,
        });
      }
      await queryInterface.addIndex(table, [column]).catch(() => {});
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map(String).map(x => x.toLowerCase());

    if (!names.includes('government_voter_lists')) return;

    const definition = await queryInterface.describeTable('government_voter_lists');
    if (definition.deleted_at) {
      await queryInterface.removeColumn('government_voter_lists', 'deleted_at');
    }
  },
};
