'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('voter_profiles');

    if (!table.voter_center) {
      await queryInterface.addColumn('voter_profiles', 'voter_center', {
        type: Sequelize.STRING(300),
        allowNull: true,
      });
    }

    if (!table.voter_room) {
      await queryInterface.addColumn('voter_profiles', 'voter_room', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('voter_profiles');
    if (table.voter_room) await queryInterface.removeColumn('voter_profiles', 'voter_room');
    if (table.voter_center) await queryInterface.removeColumn('voter_profiles', 'voter_center');
  },
};
