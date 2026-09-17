'use strict';

const { randomUUID } = require('crypto');

function tableNames(tables) {
  return tables
    .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
    .map((n) => String(n).toLowerCase());
}

async function hasTable(queryInterface, name) {
  const names = tableNames(await queryInterface.showAllTables());
  return names.includes(String(name).toLowerCase());
}

async function hasIndex(queryInterface, table, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT INDEX_NAME FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = :table AND index_name = :name
     LIMIT 1`,
    { replacements: { table, name } }
  );
  return Boolean(rows.length);
}

async function addIndexIfMissing(queryInterface, table, fields, name, options = {}) {
  if (await hasIndex(queryInterface, table, name)) return;
  await queryInterface.addIndex(table, fields, { name, ...options });
}

async function addConstraintIfMissing(queryInterface, table, name, options) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE table_schema = DATABASE() AND table_name = :table AND constraint_name = :name
     LIMIT 1`,
    { replacements: { table, name } }
  );
  if (rows.length) return;
  try {
    await queryInterface.addConstraint(table, { name, ...options });
  } catch (err) {
    console.warn(`[migrate] skip constraint ${name}:`, err.message);
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    const now = new Date();
    const uuidPk = { type: DataTypes.UUID, allowNull: false, primaryKey: true };
    const timestamps = {
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    };
    const tableOpts = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };

    if (!(await hasTable(queryInterface, 'person_documents'))) {
      await queryInterface.createTable('person_documents', {
        id: uuidPk,
        person_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'persons', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        doc_type: { type: DataTypes.ENUM('VOTER_ID', 'AADHAAR', 'PAN'), allowNull: false },
        content: { type: DataTypes.TEXT('long'), allowNull: true },
        mime_type: { type: DataTypes.STRING(80), allowNull: true },
        file_name: { type: DataTypes.STRING(255), allowNull: true },
        storage_key: { type: DataTypes.STRING(500), allowNull: true },
        ...timestamps,
      }, tableOpts);
      await queryInterface.addIndex('person_documents', ['person_id', 'doc_type'], {
        unique: true,
        name: 'person_documents_person_type_uq',
      });
      await queryInterface.addIndex('person_documents', ['person_id'], { name: 'person_documents_person_idx' });
    }

    if (!(await hasTable(queryInterface, 'person_birthdays'))) {
      await queryInterface.createTable('person_birthdays', {
        id: uuidPk,
        person_id: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          references: { model: 'persons', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        ward_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'wards', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        house_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'houses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        family_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'families', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        full_name: { type: DataTypes.STRING(255), allowNull: false },
        dob: { type: DataTypes.DATEONLY, allowNull: false },
        birth_month: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        birth_day: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
        ...timestamps,
      }, tableOpts);
      await queryInterface.addIndex('person_birthdays', ['ward_id', 'status', 'birth_month', 'birth_day'], {
        name: 'person_birthdays_ward_day_idx',
      });
      await queryInterface.addIndex('person_birthdays', ['status', 'birth_month', 'birth_day'], {
        name: 'person_birthdays_day_idx',
      });
    }

    if (!(await hasTable(queryInterface, 'death_observances'))) {
      await queryInterface.createTable('death_observances', {
        id: uuidPk,
        death_record_id: {
          type: DataTypes.UUID,
          allowNull: false,
          unique: true,
          references: { model: 'death_records', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        person_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'persons', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        ward_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'wards', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        house_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'houses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        family_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'families', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        date_of_death: { type: DataTypes.DATEONLY, allowNull: false },
        tenth_day_on: { type: DataTypes.DATEONLY, allowNull: false },
        first_year_on: { type: DataTypes.DATEONLY, allowNull: false },
        status: { type: DataTypes.ENUM('ACTIVE', 'CANCELLED'), allowNull: false, defaultValue: 'ACTIVE' },
        recorded_notified_at: { type: DataTypes.DATE, allowNull: true },
        tenth_day_notified_at: { type: DataTypes.DATE, allowNull: true },
        first_year_notified_at: { type: DataTypes.DATE, allowNull: true },
        ...timestamps,
      }, tableOpts);
      await queryInterface.addIndex('death_observances', ['ward_id', 'status', 'tenth_day_on'], {
        name: 'death_observances_ward_tenth_idx',
      });
      await queryInterface.addIndex('death_observances', ['ward_id', 'status', 'first_year_on'], {
        name: 'death_observances_ward_year_idx',
      });
      await queryInterface.addIndex('death_observances', ['tenth_day_on', 'status'], {
        name: 'death_observances_tenth_idx',
      });
      await queryInterface.addIndex('death_observances', ['first_year_on', 'status'], {
        name: 'death_observances_year_idx',
      });
    }

    if (!(await hasTable(queryInterface, 'ward_subscription_events'))) {
      await queryInterface.createTable('ward_subscription_events', {
        id: uuidPk,
        subscription_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'ward_nagarsevak_subscriptions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        ward_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'wards', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        nagarsevak_user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        action: {
          type: DataTypes.ENUM('CREATED', 'ACTIVATED', 'DEACTIVATED', 'REACTIVATED', 'YEAR_ENDED_NOTIFIED', 'NOTES_UPDATED'),
          allowNull: false,
        },
        from_status: { type: DataTypes.STRING(32), allowNull: true },
        to_status: { type: DataTypes.STRING(32), allowNull: true },
        acted_by: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        acted_at: { type: DataTypes.DATE, allowNull: false },
        notes: { type: DataTypes.TEXT, allowNull: true },
        ...timestamps,
      }, tableOpts);
      await queryInterface.addIndex('ward_subscription_events', ['subscription_id', 'acted_at'], {
        name: 'ward_sub_events_sub_acted_idx',
      });
      await queryInterface.addIndex('ward_subscription_events', ['ward_id', 'acted_at'], {
        name: 'ward_sub_events_ward_acted_idx',
      });
    }

    if (!(await hasTable(queryInterface, 'employee_area_assignments'))) {
      await queryInterface.createTable('employee_area_assignments', {
        id: uuidPk,
        employee_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'employees', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        area_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'areas', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        ...timestamps,
      }, tableOpts);
      await queryInterface.addIndex('employee_area_assignments', ['employee_id', 'area_id'], {
        unique: true,
        name: 'employee_area_assignments_uq',
      });
      await queryInterface.addIndex('employee_area_assignments', ['area_id'], {
        name: 'employee_area_assignments_area_idx',
      });
    }

    if (!(await hasTable(queryInterface, 'complaint_attachments'))) {
      await queryInterface.createTable('complaint_attachments', {
        id: uuidPk,
        complaint_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'complaints', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        kind: { type: DataTypes.ENUM('REPORTED', 'RESOLUTION'), allowNull: false },
        content: { type: DataTypes.TEXT('long'), allowNull: true },
        mime_type: { type: DataTypes.STRING(80), allowNull: true },
        storage_key: { type: DataTypes.STRING(500), allowNull: true },
        ...timestamps,
      }, tableOpts);
      await queryInterface.addIndex('complaint_attachments', ['complaint_id', 'kind'], {
        unique: true,
        name: 'complaint_attachments_kind_uq',
      });
    }

    const personCols = await queryInterface.describeTable('persons');
    if (personCols.voter_id_image || personCols.aadhaar_image || personCols.pan_card_image) {
      const [docs] = await queryInterface.sequelize.query(
        `SELECT id, voter_id_image, aadhaar_image, pan_card_image
         FROM persons
         WHERE (voter_id_image IS NOT NULL AND voter_id_image <> '')
            OR (aadhaar_image IS NOT NULL AND aadhaar_image <> '')
            OR (pan_card_image IS NOT NULL AND pan_card_image <> '')`
      );
      for (const row of docs) {
        const pairs = [
          ['VOTER_ID', row.voter_id_image],
          ['AADHAAR', row.aadhaar_image],
          ['PAN', row.pan_card_image],
        ];
        for (const [docType, content] of pairs) {
          if (!content) continue;
          await queryInterface.bulkInsert('person_documents', [{
            id: randomUUID(),
            person_id: row.id,
            doc_type: docType,
            content,
            created_at: now,
            updated_at: now,
          }]);
        }
      }
      if (personCols.voter_id_image) await queryInterface.removeColumn('persons', 'voter_id_image');
      if (personCols.aadhaar_image) await queryInterface.removeColumn('persons', 'aadhaar_image');
      if (personCols.pan_card_image) await queryInterface.removeColumn('persons', 'pan_card_image');
    }

    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO person_birthdays
        (id, person_id, ward_id, house_id, family_id, full_name, dob, birth_month, birth_day, status, created_at, updated_at)
      SELECT UUID(), p.id, a.ward_id, h.id, p.family_id, p.full_name, p.dob,
             MONTH(p.dob), DAY(p.dob),
             IF(p.status = 'ACTIVE' AND p.deleted_at IS NULL, 'ACTIVE', 'INACTIVE'),
             NOW(), NOW()
      FROM persons p
      LEFT JOIN families f ON f.id = p.family_id
      LEFT JOIN houses h ON h.id = f.house_id
      LEFT JOIN areas a ON a.id = h.area_id
      WHERE p.dob IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO death_observances
        (id, death_record_id, person_id, ward_id, house_id, family_id, date_of_death, tenth_day_on, first_year_on, status, created_at, updated_at)
      SELECT UUID(), dr.id, dr.person_id, a.ward_id, h.id, p.family_id, dr.date_of_death,
             DATE_ADD(dr.date_of_death, INTERVAL 10 DAY),
             DATE_ADD(dr.date_of_death, INTERVAL 1 YEAR),
             IF(dr.record_status = 'ACTIVE', 'ACTIVE', 'CANCELLED'),
             NOW(), NOW()
      FROM death_records dr
      INNER JOIN persons p ON p.id = dr.person_id
      LEFT JOIN families f ON f.id = p.family_id
      LEFT JOIN houses h ON h.id = f.house_id
      LEFT JOIN areas a ON a.id = h.area_id
    `);

    const [employees] = await queryInterface.sequelize.query(
      'SELECT id, assigned_area_ids FROM employees WHERE assigned_area_ids IS NOT NULL'
    );
    for (const emp of employees) {
      const ids = [...new Set(parseJsonArray(emp.assigned_area_ids).filter(Boolean).map(String))];
      for (const areaId of ids) {
        await queryInterface.bulkInsert('employee_area_assignments', [{
          id: randomUUID(),
          employee_id: emp.id,
          area_id: areaId,
          created_at: now,
          updated_at: now,
        }]).catch(() => {});
      }
    }

    const [complaints] = await queryInterface.sequelize.query(
      `SELECT id, reported_image, resolution_image FROM complaints
       WHERE (reported_image IS NOT NULL AND reported_image <> '')
          OR (resolution_image IS NOT NULL AND resolution_image <> '')`
    );
    for (const row of complaints) {
      const pairs = [
        ['REPORTED', row.reported_image],
        ['RESOLUTION', row.resolution_image],
      ];
      for (const [kind, content] of pairs) {
        if (!content) continue;
        await queryInterface.bulkInsert('complaint_attachments', [{
          id: randomUUID(),
          complaint_id: row.id,
          kind,
          content,
          created_at: now,
          updated_at: now,
        }]).catch(() => {});
      }
    }

    const [subs] = await queryInterface.sequelize.query(
      `SELECT id, ward_id, nagarsevak_user_id, status, purchased_at, activated_at, activated_by,
              deactivated_at, deactivated_by, notes, created_at, expiry_notified_at
       FROM ward_nagarsevak_subscriptions`
    );
    for (const sub of subs) {
      const events = [];
      events.push({
        action: 'CREATED',
        fromStatus: null,
        toStatus: 'PENDING',
        actedBy: null,
        actedAt: sub.created_at || now,
        notes: null,
      });
      if (sub.activated_at) {
        events.push({
          action: sub.status === 'ACTIVE' ? 'ACTIVATED' : 'ACTIVATED',
          fromStatus: 'PENDING',
          toStatus: 'ACTIVE',
          actedBy: sub.activated_by || null,
          actedAt: sub.activated_at,
          notes: sub.notes || null,
        });
      }
      if (sub.deactivated_at) {
        events.push({
          action: 'DEACTIVATED',
          fromStatus: 'ACTIVE',
          toStatus: sub.status || 'DEACTIVATED',
          actedBy: sub.deactivated_by || null,
          actedAt: sub.deactivated_at,
          notes: sub.notes || null,
        });
      }
      if (sub.expiry_notified_at) {
        events.push({
          action: 'YEAR_ENDED_NOTIFIED',
          fromStatus: sub.status,
          toStatus: sub.status,
          actedBy: null,
          actedAt: sub.expiry_notified_at,
          notes: null,
        });
      }
      for (const event of events) {
        await queryInterface.bulkInsert('ward_subscription_events', [{
          id: randomUUID(),
          subscription_id: sub.id,
          ward_id: sub.ward_id,
          nagarsevak_user_id: sub.nagarsevak_user_id,
          action: event.action,
          from_status: event.fromStatus,
          to_status: event.toStatus,
          acted_by: event.actedBy,
          acted_at: event.actedAt,
          notes: event.notes,
          created_at: event.actedAt || now,
          updated_at: event.actedAt || now,
        }]).catch(() => {});
      }
    }

    await addConstraintIfMissing(queryInterface, 'death_records', 'death_records_reported_by_fk', {
      fields: ['reported_by'],
      type: 'foreign key',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
    await addConstraintIfMissing(queryInterface, 'ward_nagarsevak_subscriptions', 'ward_nagar_sub_activated_by_fk', {
      fields: ['activated_by'],
      type: 'foreign key',
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await addConstraintIfMissing(queryInterface, 'ward_nagarsevak_subscriptions', 'ward_nagar_sub_deactivated_by_fk', {
      fields: ['deactivated_by'],
      type: 'foreign key',
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    await addIndexIfMissing(queryInterface, 'notifications', ['type', 'action_url', 'sent_at'], 'notifications_type_action_sent_idx');
    await addIndexIfMissing(queryInterface, 'notifications', ['user_id', 'is_read', 'created_at'], 'notifications_user_read_idx');
    await addIndexIfMissing(queryInterface, 'death_records', ['record_status', 'date_of_death'], 'death_records_status_date_idx');
  },

  async down(queryInterface, Sequelize) {
    const drop = [
      'complaint_attachments',
      'employee_area_assignments',
      'ward_subscription_events',
      'death_observances',
      'person_birthdays',
      'person_documents',
    ];
    for (const table of drop) {
      if (await hasTable(queryInterface, table)) await queryInterface.dropTable(table);
    }
    const { DataTypes } = Sequelize;
    const personCols = await queryInterface.describeTable('persons');
    if (!personCols.voter_id_image) {
      await queryInterface.addColumn('persons', 'voter_id_image', { type: DataTypes.TEXT('medium'), allowNull: true });
    }
    if (!personCols.aadhaar_image) {
      await queryInterface.addColumn('persons', 'aadhaar_image', { type: DataTypes.TEXT('medium'), allowNull: true });
    }
    if (!personCols.pan_card_image) {
      await queryInterface.addColumn('persons', 'pan_card_image', { type: DataTypes.TEXT('medium'), allowNull: true });
    }
  },
};
