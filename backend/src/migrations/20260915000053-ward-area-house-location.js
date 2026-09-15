'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

async function dropIfPresent(queryInterface, table, column) {
  const desc = await queryInterface.describeTable(table);
  if (desc[column]) await queryInterface.removeColumn(table, column);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const geo = { type: Sequelize.DECIMAL(10, 7), allowNull: true };
    await addIfMissing(queryInterface, 'wards', 'city', { type: Sequelize.STRING(120), allowNull: true });
    await addIfMissing(queryInterface, 'wards', 'district', { type: Sequelize.STRING(120), allowNull: true });
    await addIfMissing(queryInterface, 'wards', 'pincode', { type: Sequelize.STRING(12), allowNull: true });
    await addIfMissing(queryInterface, 'wards', 'latitude', geo);
    await addIfMissing(queryInterface, 'wards', 'longitude', geo);

    await addIfMissing(queryInterface, 'areas', 'city', { type: Sequelize.STRING(120), allowNull: true });
    await addIfMissing(queryInterface, 'areas', 'pincode', { type: Sequelize.STRING(12), allowNull: true });
    await addIfMissing(queryInterface, 'areas', 'landmark', { type: Sequelize.STRING(180), allowNull: true });
    await addIfMissing(queryInterface, 'areas', 'latitude', geo);
    await addIfMissing(queryInterface, 'areas', 'longitude', geo);

    await addIfMissing(queryInterface, 'houses', 'city', { type: Sequelize.STRING(120), allowNull: true });
    await addIfMissing(queryInterface, 'houses', 'pincode', { type: Sequelize.STRING(12), allowNull: true });
  },

  async down(queryInterface) {
    await dropIfPresent(queryInterface, 'houses', 'pincode');
    await dropIfPresent(queryInterface, 'houses', 'city');
    await dropIfPresent(queryInterface, 'areas', 'longitude');
    await dropIfPresent(queryInterface, 'areas', 'latitude');
    await dropIfPresent(queryInterface, 'areas', 'landmark');
    await dropIfPresent(queryInterface, 'areas', 'pincode');
    await dropIfPresent(queryInterface, 'areas', 'city');
    await dropIfPresent(queryInterface, 'wards', 'longitude');
    await dropIfPresent(queryInterface, 'wards', 'latitude');
    await dropIfPresent(queryInterface, 'wards', 'pincode');
    await dropIfPresent(queryInterface, 'wards', 'district');
    await dropIfPresent(queryInterface, 'wards', 'city');
  },
};
