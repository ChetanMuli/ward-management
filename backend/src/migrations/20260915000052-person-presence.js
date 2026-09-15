'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('persons');
    if (!desc.presence_status) {
      await queryInterface.addColumn('persons', 'presence_status', {
        type: Sequelize.ENUM('AT_HOME', 'OUT_OF_CITY'),
        allowNull: true,
      });
    }
    if (!desc.current_city) {
      await queryInterface.addColumn('persons', 'current_city', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
    if (!desc.living_with) {
      await queryInterface.addColumn('persons', 'living_with', {
        type: Sequelize.ENUM('FAMILY', 'SELF'),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('persons');
    if (desc.current_city) await queryInterface.removeColumn('persons', 'current_city');
    if (desc.presence_status) await queryInterface.removeColumn('persons', 'presence_status');
    if (desc.living_with) await queryInterface.removeColumn('persons', 'living_with');
  },
};
