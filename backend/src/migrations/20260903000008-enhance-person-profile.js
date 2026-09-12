'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const add = async (table, column, definition) => {
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) await queryInterface.addColumn(table, column, definition);
    };

    await add('persons', 'occupation_type', {
      type: DataTypes.ENUM('SERVICE', 'BUSINESS', 'OTHER'),
      allowNull: true,
    });
    await add('persons', 'business_name', { type: DataTypes.STRING, allowNull: true });
    await add('persons', 'business_address', { type: DataTypes.TEXT, allowNull: true });
    await add('persons', 'company_name', { type: DataTypes.STRING, allowNull: true });
    await add('persons', 'employment_type', {
      type: DataTypes.ENUM('PRIVATE', 'GOVERNMENT'),
      allowNull: true,
    });
    await add('persons', 'voter_id_image', { type: DataTypes.TEXT, allowNull: true });
    await add('persons', 'aadhaar_image', { type: DataTypes.TEXT, allowNull: true });
    await add('persons', 'pan_card_image', { type: DataTypes.TEXT, allowNull: true });


    // Backfill a voter/non-voter profile for every existing citizen so the
    // Voter/Non-Voter section is complete immediately after migration.
    const [people] = await queryInterface.sequelize.query(
      'SELECT id, dob FROM persons WHERE deleted_at IS NULL'
    );
    const [existingProfiles] = await queryInterface.sequelize.query(
      'SELECT person_id FROM voter_profiles'
    );
    const existing = new Set(existingProfiles.map(r => r.person_id));
    const today = new Date();
    const ageOf = dob => {
      const birth = new Date(dob);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return Math.max(age, 0);
    };
    const { randomUUID } = require('crypto');
    const missing = people.filter(p => !existing.has(p.id)).map(p => ({
      id: randomUUID(),
      person_id: p.id,
      status: ageOf(p.dob) < 18 ? 'NON_VOTER' : 'VERIFICATION_PENDING',
      created_at: new Date(),
      updated_at: new Date(),
    }));
    if (missing.length) await queryInterface.bulkInsert('voter_profiles', missing);

    await queryInterface.addIndex('persons', ['occupation_type']).catch(() => {});
    await queryInterface.addIndex('persons', ['company_name']).catch(() => {});
  },

  down: async (queryInterface) => {
    const remove = async (table, column) => {
      const desc = await queryInterface.describeTable(table);
      if (desc[column]) await queryInterface.removeColumn(table, column);
    };
    for (const column of [
      'pan_card_image', 'aadhaar_image', 'voter_id_image',
      'employment_type', 'company_name', 'business_address',
      'business_name', 'occupation_type',
    ]) await remove('persons', column);
  },
};
