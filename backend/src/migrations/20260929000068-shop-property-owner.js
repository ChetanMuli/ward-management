'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table).catch(() => ({}));
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'shops_and_offices', 'property_owner_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'shops_and_offices', 'property_owner_mobile', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('shops_and_offices').catch(() => ({}));
    if (desc.property_owner_name) await queryInterface.removeColumn('shops_and_offices', 'property_owner_name');
    if (desc.property_owner_mobile) await queryInterface.removeColumn('shops_and_offices', 'property_owner_mobile');
  },
};
