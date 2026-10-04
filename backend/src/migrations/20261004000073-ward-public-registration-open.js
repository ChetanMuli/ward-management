'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('wards').catch(() => ({}));
    if (!desc.registration_open) {
      await queryInterface.addColumn('wards', 'registration_open', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('wards').catch(() => ({}));
    if (desc.registration_open) {
      await queryInterface.removeColumn('wards', 'registration_open');
    }
  },
};
