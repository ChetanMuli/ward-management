'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const users = await queryInterface.describeTable('users');
    if (!users.ward_ids) {
      await queryInterface.addColumn('users', 'ward_ids', {
        type: Sequelize.JSON, allowNull: false, defaultValue: JSON.stringify([]),
      });
    }
  },
  down: async (queryInterface) => {
    const users = await queryInterface.describeTable('users');
    if (users.ward_ids) await queryInterface.removeColumn('users', 'ward_ids');
  },
};
