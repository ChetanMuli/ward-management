'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureDatabaseSchema } = require('./schemaSync.service');

test('Schema Sync Service: checks and reports gracefully', async (t) => {
  // Mock sequelize with mock queryInterface
  const mockCreatedTables = [];
  const mockAddedColumns = [];
  const mockAddedIndexes = [];
  const mockQueries = [];

  const mockQueryInterface = {
    showAllTables: async () => ['users', 'wards', 'nagarsevak_schedules', 'sequelizemeta'],
    describeTable: async (tableName) => {
      if (tableName === 'nagarsevak_schedules') {
        // simulate existing table without the new columns
        return {
          id: {},
          title: {},
          scheduled_date: {},
          status: {},
        };
      }
      return {};
    },
    addColumn: async (table, col, def) => {
      mockAddedColumns.push({ table, col, def });
    },
    addIndex: async (table, cols, opts) => {
      mockAddedIndexes.push({ table, cols, opts });
    },
    createTable: async (table, cols, opts) => {
      mockCreatedTables.push({ table, cols, opts });
    },
  };

  const mockSequelize = {
    getQueryInterface: () => mockQueryInterface,
    query: async (sql, opts) => {
      mockQueries.push({ sql, opts });
      return [];
    },
  };

  const result = await ensureDatabaseSchema(mockSequelize);
  assert.equal(result, true, 'ensureDatabaseSchema should return true on success');

  // Verify missing columns were added
  const addedColNames = mockAddedColumns.map((c) => c.col);
  assert.ok(addedColNames.includes('assigned_employee_user_id'), 'Should add assigned_employee_user_id');
  assert.ok(addedColNames.includes('assigned_to_type'), 'Should add assigned_to_type');
  assert.ok(addedColNames.includes('completion_note'), 'Should add completion_note');

  // Verify missing table nagarsevak_schedule_assignments was created
  const createdTableNames = mockCreatedTables.map((t) => t.table);
  assert.ok(createdTableNames.includes('nagarsevak_schedule_assignments'), 'Should create nagarsevak_schedule_assignments');

  // Verify SequelizeMeta updates were executed
  assert.ok(mockQueries.length > 0, 'Should update SequelizeMeta table');
});
