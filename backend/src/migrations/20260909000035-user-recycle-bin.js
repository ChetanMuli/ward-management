'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.deleted_at) {
      await queryInterface.addColumn('users', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },
  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');
    if (table.deleted_at) await queryInterface.removeColumn('users', 'deleted_at');
  },
};
