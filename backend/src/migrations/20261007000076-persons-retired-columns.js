'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'persons', 'is_retired', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addIfMissing(queryInterface, 'persons', 'retired_from', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'persons', 'retired_service', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    const desc = await queryInterface.describeTable('persons');
    if (desc.retired_service) await queryInterface.removeColumn('persons', 'retired_service');
    if (desc.retired_from) await queryInterface.removeColumn('persons', 'retired_from');
    if (desc.is_retired) await queryInterface.removeColumn('persons', 'is_retired');
  },
};
