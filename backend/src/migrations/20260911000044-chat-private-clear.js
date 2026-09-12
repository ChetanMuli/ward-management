'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const messageCols = await queryInterface.describeTable('ward_chat_messages');
    if (!messageCols.recipient_user_id) {
      await queryInterface.addColumn('ward_chat_messages', 'recipient_user_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
    const memberCols = await queryInterface.describeTable('ward_chat_group_members');
    if (!memberCols.last_cleared_at) {
      await queryInterface.addColumn('ward_chat_group_members', 'last_cleared_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const messageCols = await queryInterface.describeTable('ward_chat_messages');
    if (messageCols.recipient_user_id) await queryInterface.removeColumn('ward_chat_messages', 'recipient_user_id');
    const memberCols = await queryInterface.describeTable('ward_chat_group_members');
    if (memberCols.last_cleared_at) await queryInterface.removeColumn('ward_chat_group_members', 'last_cleared_at');
  },
};
