'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const add = async (table, column, definition) => {
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) await queryInterface.addColumn(table, column, definition);
    };

    // Add the ward-scoping fields without disturbing existing data.
    await add('users', 'ward_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'wards', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await add('employees', 'ward_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'wards', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await add('employees', 'permissions', {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: JSON.stringify([]),
    });

    // MySQL ENUM needs to be expanded explicitly for the new Nagarsevak role.
    await queryInterface.sequelize.query(
      "ALTER TABLE roles MODIFY name ENUM('SUPER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN') NOT NULL"
    );

    await queryInterface.addIndex('users', ['ward_id']).catch(() => {});
    await queryInterface.addIndex('employees', ['ward_id']).catch(() => {});
  },

  down: async (queryInterface) => {
    const remove = async (table, column) => {
      const desc = await queryInterface.describeTable(table);
      if (desc[column]) await queryInterface.removeColumn(table, column);
    };
    await remove('employees', 'permissions');
    await remove('employees', 'ward_id');
    await remove('users', 'ward_id');
    await queryInterface.sequelize.query(
      "ALTER TABLE roles MODIFY name ENUM('SUPER_ADMIN','EMPLOYEE','CITIZEN') NOT NULL"
    );
  },
};
