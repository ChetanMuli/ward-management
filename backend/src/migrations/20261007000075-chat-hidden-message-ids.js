'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

async function dropIfPresent(queryInterface, table, column) {
  const desc = await queryInterface.describeTable(table);
  if (desc[column]) await queryInterface.removeColumn(table, column);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'chat_user_state', 'hidden_message_ids', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await dropIfPresent(queryInterface, 'chat_user_state', 'hidden_message_ids');
  },
};
