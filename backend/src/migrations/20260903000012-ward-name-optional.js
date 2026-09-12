'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('wards', 'name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE wards SET name = CONCAT('Ward ', ward_number) WHERE name IS NULL OR name = ''"
    );
    await queryInterface.changeColumn('wards', 'name', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
