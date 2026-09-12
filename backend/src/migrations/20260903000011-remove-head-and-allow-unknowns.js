'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Family head is not part of the application workflow anymore.
    await queryInterface.removeColumn('families', 'family_head_person_id').catch(() => {});

    // Allow a record to be created when a citizen's DOB/gender is genuinely unavailable.
    await queryInterface.changeColumn('persons', 'dob', { type: Sequelize.DATEONLY, allowNull: true });
    await queryInterface.changeColumn('persons', 'gender', {
      type: Sequelize.ENUM('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'),
      allowNull: false,
      defaultValue: 'NOT_SPECIFIED'
    });

    // Adults can remain unclassified until the operator actually knows their voter status.
    await queryInterface.changeColumn('voter_profiles', 'status', {
      type: Sequelize.ENUM('VOTER', 'NON_VOTER', 'NOT_SPECIFIED', 'DECEASED', 'MOVED_OUT'),
      allowNull: false,
      defaultValue: 'NOT_SPECIFIED'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('families', 'family_head_person_id', { type: Sequelize.UUID, allowNull: true }).catch(() => {});
    await queryInterface.changeColumn('persons', 'dob', { type: Sequelize.DATEONLY, allowNull: false });
    await queryInterface.changeColumn('persons', 'gender', {
      type: Sequelize.ENUM('MALE', 'FEMALE', 'OTHER'),
      allowNull: false
    });
    await queryInterface.changeColumn('voter_profiles', 'status', {
      type: Sequelize.ENUM('VOTER', 'NON_VOTER', 'DECEASED', 'MOVED_OUT'),
      allowNull: false,
      defaultValue: 'NON_VOTER'
    });
  }
};
