'use strict';

const { DataTypes } = require('sequelize');

/**
 * Idempotently ensures all critical database tables, columns, and indexes exist.
 * This guarantees zero downtime and prevents "Unknown column" errors when code
 * is deployed without manually running database migrations.
 */
async function ensureDatabaseSchema(sequelize) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const rawTables = await queryInterface.showAllTables();
    const tables = rawTables.map((t) =>
      String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase()
    );

    // 1. nagarsevak_schedules table
    if (!tables.includes('nagarsevak_schedules')) {
      console.log('[SCHEMA-SYNC] Creating table nagarsevak_schedules...');
      await queryInterface.createTable('nagarsevak_schedules', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
        nagarsevak_user_id: { type: DataTypes.UUID, allowNull: false },
        created_by_user_id: { type: DataTypes.UUID, allowNull: false },
        ward_id: { type: DataTypes.UUID, allowNull: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: true },
        scheduled_date: { type: DataTypes.DATEONLY, allowNull: false },
        scheduled_time: { type: DataTypes.STRING(50), allowNull: true },
        location: { type: DataTypes.STRING(255), allowNull: true },
        category: {
          type: DataTypes.ENUM('VISIT', 'MEETING', 'INSPECTION', 'EVENT', 'CITIZEN_HEARING', 'OTHER'),
          allowNull: false,
          defaultValue: 'VISIT',
        },
        priority: {
          type: DataTypes.ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW'),
          allowNull: false,
          defaultValue: 'MEDIUM',
        },
        status: {
          type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        completed_at: { type: DataTypes.DATE, allowNull: true },
        completed_by_user_id: { type: DataTypes.UUID, allowNull: true },
        assigned_employee_user_id: { type: DataTypes.UUID, allowNull: true },
        assigned_to_type: {
          type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE'),
          allowNull: false,
          defaultValue: 'NAGARSEVAK',
        },
        completion_note: { type: DataTypes.TEXT, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

      await queryInterface.addIndex('nagarsevak_schedules', ['nagarsevak_user_id', 'scheduled_date']).catch(() => {});
      await queryInterface.addIndex('nagarsevak_schedules', ['assigned_employee_user_id']).catch(() => {});
      await queryInterface.addIndex('nagarsevak_schedules', ['ward_id', 'scheduled_date']).catch(() => {});
      await queryInterface.addIndex('nagarsevak_schedules', ['status']).catch(() => {});
    } else {
      const desc = await queryInterface.describeTable('nagarsevak_schedules').catch(() => ({}));

      if (!desc.assigned_employee_user_id) {
        console.log('[SCHEMA-SYNC] Adding missing column nagarsevak_schedules.assigned_employee_user_id...');
        await queryInterface.addColumn('nagarsevak_schedules', 'assigned_employee_user_id', {
          type: DataTypes.UUID,
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn assigned_employee_user_id:', e.message));
        await queryInterface.addIndex('nagarsevak_schedules', ['assigned_employee_user_id']).catch(() => {});
      }

      if (!desc.assigned_to_type) {
        console.log('[SCHEMA-SYNC] Adding missing column nagarsevak_schedules.assigned_to_type...');
        await queryInterface.addColumn('nagarsevak_schedules', 'assigned_to_type', {
          type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE'),
          allowNull: false,
          defaultValue: 'NAGARSEVAK',
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn assigned_to_type:', e.message));
      }

      if (!desc.completion_note) {
        console.log('[SCHEMA-SYNC] Adding missing column nagarsevak_schedules.completion_note...');
        await queryInterface.addColumn('nagarsevak_schedules', 'completion_note', {
          type: DataTypes.TEXT,
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn completion_note:', e.message));
      }
    }

    // 2. nagarsevak_schedule_assignments table
    if (!tables.includes('nagarsevak_schedule_assignments')) {
      console.log('[SCHEMA-SYNC] Creating table nagarsevak_schedule_assignments...');
      await queryInterface.createTable('nagarsevak_schedule_assignments', {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        schedule_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        from_type: { type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE', 'UNASSIGNED'), allowNull: false },
        from_user_id: { type: DataTypes.UUID, allowNull: true },
        to_type: { type: DataTypes.ENUM('NAGARSEVAK', 'EMPLOYEE', 'UNASSIGNED'), allowNull: false },
        to_user_id: { type: DataTypes.UUID, allowNull: true },
        assigned_by_user_id: { type: DataTypes.UUID, allowNull: false },
        note: { type: DataTypes.STRING(255), allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

      await queryInterface.addIndex('nagarsevak_schedule_assignments', ['schedule_id', 'created_at'], { name: 'idx_sched_assign_schedule' }).catch(() => {});
      await queryInterface.addIndex('nagarsevak_schedule_assignments', ['to_user_id'], { name: 'idx_sched_assign_to' }).catch(() => {});
    }

    // 3. Register migrations in SequelizeMeta table if present
    if (tables.includes('sequelizemeta')) {
      const migrationsToRegister = [
        '20260922000064-nagarsevak-daily-schedule.js',
        '20260924000065-schedule-assigned-employee.js',
        '20260924000066-schedule-assignments.js',
      ];
      for (const mName of migrationsToRegister) {
        await sequelize.query('INSERT IGNORE INTO SequelizeMeta (name) VALUES (:name)', {
          replacements: { name: mName },
        }).catch(() => {});
      }
    }

    console.log('[SCHEMA-SYNC] Database schema check completed successfully.');
    return true;
  } catch (err) {
    console.error('[SCHEMA-SYNC ERROR]', err.message);
    return false;
  }
}

module.exports = { ensureDatabaseSchema };
