'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const d = await queryInterface.describeTable('death_records');
    if (!d.previous_voter_status) {
      await queryInterface.addColumn('death_records', 'previous_voter_status', {
        type: Sequelize.ENUM('VOTER','NON_VOTER','NOT_SPECIFIED','DECEASED'),
        allowNull: true,
      });
    }
    if (!d.record_status) {
      await queryInterface.addColumn('death_records', 'record_status', {
        type: Sequelize.ENUM('ACTIVE','RESTORED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      });
    }
    if (!d.restored_by) await queryInterface.addColumn('death_records','restored_by',{type:Sequelize.UUID,allowNull:true});
    if (!d.restored_at) await queryInterface.addColumn('death_records','restored_at',{type:Sequelize.DATE,allowNull:true});
  },
  down: async (queryInterface) => {
    const d = await queryInterface.describeTable('death_records');
    if (d.restored_at) await queryInterface.removeColumn('death_records','restored_at');
    if (d.restored_by) await queryInterface.removeColumn('death_records','restored_by');
    if (d.record_status) await queryInterface.removeColumn('death_records','record_status');
    if (d.previous_voter_status) await queryInterface.removeColumn('death_records','previous_voter_status');
  },
};
