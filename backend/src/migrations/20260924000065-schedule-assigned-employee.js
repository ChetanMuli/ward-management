'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables
      .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
      .map((n) => String(n).toLowerCase());
    if (!names.includes('nagarsevak_schedules')) return;

    const desc = await queryInterface.describeTable('nagarsevak_schedules');
    if (!desc.assigned_employee_user_id) {
      await queryInterface.addColumn('nagarsevak_schedules', 'assigned_employee_user_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('nagarsevak_schedules', ['assigned_employee_user_id']);
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables
      .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
      .map((n) => String(n).toLowerCase());
    if (!names.includes('nagarsevak_schedules')) return;
    const desc = await queryInterface.describeTable('nagarsevak_schedules');
    if (desc.assigned_employee_user_id) {
      await queryInterface.removeColumn('nagarsevak_schedules', 'assigned_employee_user_id');
    }
  },
};
