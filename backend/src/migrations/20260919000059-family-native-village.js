'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'families', 'native_village', { type: Sequelize.STRING(160), allowNull: true });
    await addIfMissing(queryInterface, 'families', 'native_taluka', { type: Sequelize.STRING(120), allowNull: true });
    await addIfMissing(queryInterface, 'families', 'native_district', { type: Sequelize.STRING(120), allowNull: true });
    await addIfMissing(queryInterface, 'families', 'native_state', { type: Sequelize.STRING(80), allowNull: true });
  },
  async down(queryInterface) {
    const desc = await queryInterface.describeTable('families');
    if (desc.native_state) await queryInterface.removeColumn('families', 'native_state');
    if (desc.native_district) await queryInterface.removeColumn('families', 'native_district');
    if (desc.native_taluka) await queryInterface.removeColumn('families', 'native_taluka');
    if (desc.native_village) await queryInterface.removeColumn('families', 'native_village');
  },
};
