'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable('wards').catch(() => ({}));
    if (!desc.registration_invite_code) {
      await queryInterface.addColumn('wards', 'registration_invite_code', {
        type: Sequelize.STRING(12),
        allowNull: true,
      });
      await queryInterface.addIndex('wards', ['registration_invite_code'], {
        unique: true,
        name: 'uq_wards_registration_invite_code',
      }).catch(() => {});
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('wards').catch(() => ({}));
    if (desc.registration_invite_code) {
      await queryInterface.removeIndex('wards', 'uq_wards_registration_invite_code').catch(() => {});
      await queryInterface.removeColumn('wards', 'registration_invite_code');
    }
  },
};
