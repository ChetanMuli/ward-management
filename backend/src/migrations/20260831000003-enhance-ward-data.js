'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const add = async (table, column, definition) => {
      const desc = await queryInterface.describeTable(table);
      if (!desc[column]) await queryInterface.addColumn(table, column, definition);
    };

    const softDelete = { type: DataTypes.DATE, allowNull: true };
    for (const table of ['wards', 'areas', 'houses', 'families', 'persons', 'voter_profiles', 'complaints']) {
      await add(table, 'deleted_at', softDelete);
    }

    await add('families', 'family_name', { type: DataTypes.STRING, allowNull: true });
    await add('persons', 'relationship_to_head', { type: DataTypes.STRING, allowNull: true });
    await add('persons', 'followup_status', { type: DataTypes.ENUM('NOT_CONTACTED','CONTACTED','DOCUMENTS_PENDING','GUIDANCE_GIVEN','COMPLETED','OTHER'), defaultValue: 'NOT_CONTACTED' });
    await add('persons', 'followup_date', { type: DataTypes.DATEONLY, allowNull: true });
    await add('persons', 'followup_notes', { type: DataTypes.TEXT, allowNull: true });
    await add('persons', 'followup_employee_id', { type: DataTypes.UUID, allowNull: true });
    await add('voter_profiles', 'voting_ward', { type: DataTypes.STRING, allowNull: true });

    await queryInterface.addIndex('families', ['family_name']).catch(() => {});
    await queryInterface.addIndex('persons', ['relationship_to_head']).catch(() => {});
    await queryInterface.addIndex('persons', ['followup_status']).catch(() => {});
    await queryInterface.addIndex('voter_profiles', ['status']).catch(() => {});
  },

  down: async (queryInterface) => {
    const remove = async (table, column) => {
      const desc = await queryInterface.describeTable(table);
      if (desc[column]) await queryInterface.removeColumn(table, column);
    };
    await remove('voter_profiles', 'voting_ward');
    await remove('persons', 'followup_employee_id');
    await remove('persons', 'followup_notes');
    await remove('persons', 'followup_date');
    await remove('persons', 'followup_status');
    await remove('persons', 'relationship_to_head');
    await remove('families', 'family_name');
    for (const table of ['complaints', 'voter_profiles', 'persons', 'families', 'houses', 'areas', 'wards']) await remove(table, 'deleted_at');
  },
};
