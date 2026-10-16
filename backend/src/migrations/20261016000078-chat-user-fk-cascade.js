'use strict';

const { repairChatUserForeignKeys } = require('../services/schemaSync.service');

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const raw = await queryInterface.showAllTables();
    const tables = raw.map((t) =>
      String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase()
    );
    await repairChatUserForeignKeys(sequelize, tables);
  },

  async down() {
    // Keep CASCADE so dumps stay importable.
  },
};
