'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const desc = await queryInterface.describeTable('employees');
    if (!desc.manager_user_id) {
      await queryInterface.addColumn('employees', 'manager_user_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      await queryInterface.addIndex('employees', ['manager_user_id']).catch(() => {});
    }
  },
  down: async (queryInterface) => {
    const desc = await queryInterface.describeTable('employees');
    if (desc.manager_user_id) await queryInterface.removeColumn('employees', 'manager_user_id');
  },
};
