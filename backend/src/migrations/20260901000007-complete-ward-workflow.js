'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const add = async (table, column, definition) => {
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) await queryInterface.addColumn(table, column, definition);
    };

    await add('complaints', 'reported_image', { type: DataTypes.TEXT, allowNull: true });
    await add('complaints', 'resolution_image', { type: DataTypes.TEXT, allowNull: true });
  },

  down: async (queryInterface) => {
    const remove = async (table, column) => {
      const desc = await queryInterface.describeTable(table);
      if (desc[column]) await queryInterface.removeColumn(table, column);
    };
    for (const column of ['resolved_at', 'resolution_note', 'assigned_employee_id', 'resolution_image', 'reported_image']) {
      await remove('complaints', column);
    }
  },
};
