'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const d = await queryInterface.describeTable('notifications');
    if (!d.sender_user_id) {
      await queryInterface.addColumn('notifications', 'sender_user_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },
  down: async (queryInterface) => {
    const d = await queryInterface.describeTable('notifications');
    if (d.sender_user_id) await queryInterface.removeColumn('notifications', 'sender_user_id');
  },
};
