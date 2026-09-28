'use strict';
const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ['all_chat_messages', 'group_chat_messages', 'ward_chat_messages'];
    for (const table of tables) {
      try {
        const desc = await queryInterface.describeTable(table).catch(() => null);
        if (desc && !desc.deleted_at && !desc.deletedAt) {
          await queryInterface.addColumn(table, 'deleted_at', {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
          });
          await queryInterface.addIndex(table, ['deleted_at']).catch(() => {});
        }
      } catch (_) {}
    }
  },

  async down(queryInterface) {
    const tables = ['all_chat_messages', 'group_chat_messages', 'ward_chat_messages'];
    for (const table of tables) {
      try {
        const desc = await queryInterface.describeTable(table).catch(() => null);
        if (desc && desc.deleted_at) {
          await queryInterface.removeColumn(table, 'deleted_at').catch(() => {});
        }
      } catch (_) {}
    }
  }
};
