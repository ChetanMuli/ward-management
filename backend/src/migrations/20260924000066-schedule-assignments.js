'use strict';

const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    const tables = (await queryInterface.showAllTables()).map((t) => String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase());
    if (!tables.includes('nagarsevak_schedules')) return;

    const desc = await queryInterface.describeTable('nagarsevak_schedules');
    if (!desc.assigned_to_type) {
      await queryInterface.addColumn('nagarsevak_schedules', 'assigned_to_type', {
        type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE'),
        allowNull: false,
        defaultValue: 'NAGARSEVAK',
      });
      await queryInterface.sequelize.query(`
        UPDATE nagarsevak_schedules
        SET assigned_to_type = CASE WHEN assigned_employee_user_id IS NULL THEN 'NAGARSEVAK' ELSE 'EMPLOYEE' END
      `);
    }

    if (tables.includes('nagarsevak_schedule_assignments')) return;

    await queryInterface.createTable('nagarsevak_schedule_assignments', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      schedule_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'nagarsevak_schedules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      from_type: { type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE', 'UNASSIGNED'), allowNull: false },
      from_user_id: { type: DataTypes.UUID, allowNull: true },
      to_type: { type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE', 'UNASSIGNED'), allowNull: false },
      to_user_id: { type: DataTypes.UUID, allowNull: true },
      assigned_by_user_id: { type: DataTypes.UUID, allowNull: false },
      note: { type: DataTypes.STRING(255), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await queryInterface.addIndex('nagarsevak_schedule_assignments', ['schedule_id', 'created_at'], { name: 'idx_sched_assign_schedule' });
    await queryInterface.addIndex('nagarsevak_schedule_assignments', ['to_user_id'], { name: 'idx_sched_assign_to' });

    const [rows] = await queryInterface.sequelize.query(`
      SELECT id, nagarsevak_user_id, created_by_user_id, assigned_employee_user_id, created_at
      FROM nagarsevak_schedules
      WHERE deleted_at IS NULL
    `);
    if (rows?.length) {
      const nowRows = rows.map((r) => ({
        id: randomUUID(),
        schedule_id: r.id,
        from_type: 'UNASSIGNED',
        from_user_id: null,
        to_type: r.assigned_employee_user_id ? 'EMPLOYEE' : 'NAGARSEVAK',
        to_user_id: r.assigned_employee_user_id || r.nagarsevak_user_id,
        assigned_by_user_id: r.created_by_user_id,
        note: 'Initial assignment',
        created_at: r.created_at || new Date(),
      }));
      await queryInterface.bulkInsert('nagarsevak_schedule_assignments', nowRows);
    }
  },

  async down(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase());
    if (tables.includes('nagarsevak_schedule_assignments')) {
      await queryInterface.dropTable('nagarsevak_schedule_assignments');
    }
    const desc = await queryInterface.describeTable('nagarsevak_schedules').catch(() => null);
    if (desc?.assigned_to_type) {
      await queryInterface.removeColumn('nagarsevak_schedules', 'assigned_to_type');
    }
  },
};
