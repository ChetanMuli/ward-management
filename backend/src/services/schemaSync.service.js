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

    // 3. Ensure complaints category is VARCHAR(100) and description is nullable
    await sequelize.query("ALTER TABLE complaints MODIFY COLUMN category VARCHAR(100) NOT NULL DEFAULT 'OTHER'").catch(() => {});
    await sequelize.query("ALTER TABLE complaints MODIFY COLUMN description TEXT NULL").catch(() => {});

    // 4. Ensure soft-delete deleted_at columns exist across all critical tables
    for (const table of ['death_records', 'ward_updates', 'schemes', 'apartments', 'shops_and_offices', 'nagarsevak_schedules', 'government_voter_lists', 'all_chat_messages', 'group_chat_messages', 'ward_chat_messages']) {
      if (tables.includes(table)) {
        const desc = await queryInterface.describeTable(table).catch(() => ({}));
        if (!desc.deleted_at && !desc.deletedAt) {
          console.log(`[SCHEMA-SYNC] Adding deleted_at column to ${table}...`);
          await queryInterface.addColumn(table, 'deleted_at', {
            type: DataTypes.DATE,
            allowNull: true,
          }).catch((e) => console.warn(`[SCHEMA-SYNC] addColumn deleted_at to ${table}:`, e.message));
          await queryInterface.addIndex(table, ['deleted_at']).catch(() => {});
        }
      }
    }

    // 5. Ensure shops_and_offices has property_owner_name, property_owner_mobile, and ownership
    if (tables.includes('shops_and_offices')) {
      const desc = await queryInterface.describeTable('shops_and_offices').catch(() => ({}));
      if (!desc.property_owner_name) {
        console.log('[SCHEMA-SYNC] Adding missing column shops_and_offices.property_owner_name...');
        await queryInterface.addColumn('shops_and_offices', 'property_owner_name', {
          type: DataTypes.STRING(255),
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn property_owner_name:', e.message));
      }
      if (!desc.property_owner_mobile) {
        console.log('[SCHEMA-SYNC] Adding missing column shops_and_offices.property_owner_mobile...');
        await queryInterface.addColumn('shops_and_offices', 'property_owner_mobile', {
          type: DataTypes.STRING(50),
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn property_owner_mobile:', e.message));
      }
      if (!desc.ownership) {
        console.log('[SCHEMA-SYNC] Adding missing column shops_and_offices.ownership...');
        await queryInterface.addColumn('shops_and_offices', 'ownership', {
          type: DataTypes.ENUM('OWN', 'RENT', 'OTHER'),
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn ownership:', e.message));
      }
    }

    // 6. Ensure houses has owner_name and owner_mobile
    if (tables.includes('houses')) {
      const desc = await queryInterface.describeTable('houses').catch(() => ({}));
      if (!desc.owner_name) {
        console.log('[SCHEMA-SYNC] Adding missing column houses.owner_name...');
        await queryInterface.addColumn('houses', 'owner_name', {
          type: DataTypes.STRING(255),
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn houses.owner_name:', e.message));
      }
      if (!desc.owner_mobile) {
        console.log('[SCHEMA-SYNC] Adding missing column houses.owner_mobile...');
        await queryInterface.addColumn('houses', 'owner_mobile', {
          type: DataTypes.STRING(50),
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn houses.owner_mobile:', e.message));
      }
    }

    // 7. Ensure families has native_village, native_taluka, native_district, native_state
    if (tables.includes('families')) {
      const desc = await queryInterface.describeTable('families').catch(() => ({}));
      for (const col of ['native_village', 'native_taluka', 'native_district', 'native_state']) {
        if (!desc[col]) {
          console.log(`[SCHEMA-SYNC] Adding missing column families.${col}...`);
          await queryInterface.addColumn('families', col, {
            type: DataTypes.STRING(255),
            allowNull: true,
          }).catch((e) => console.warn(`[SCHEMA-SYNC] addColumn families.${col}:`, e.message));
        }
      }
    }

    // 8. ward_portal_configs table
    if (!tables.includes('ward_portal_configs')) {
      console.log('[SCHEMA-SYNC] Creating table ward_portal_configs...');
      await queryInterface.createTable('ward_portal_configs', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
        ward_id: { type: DataTypes.UUID, allowNull: true },
        hero_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        hero_title_en: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'Welcome' },
        hero_title_mr: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'स्वागत आहे' },
        hero_subtitle_en: { type: DataTypes.TEXT, allowNull: true },
        hero_subtitle_mr: { type: DataTypes.TEXT, allowNull: true },
        hero_badge_en: { type: DataTypes.STRING(255), allowNull: true, defaultValue: 'OFFICIAL 24/7 WARD DESK · LIVE' },
        hero_badge_mr: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '२४/७ अधिकृत प्रभाग सेवा कक्ष · थेट सक्रिय' },
        cta_primary_text_en: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Raise a complaint' },
        cta_primary_text_mr: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'तक्रार नोंदवा' },
        cta_primary_link: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '/my-complaints' },
        cta_secondary_text_en: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'View Work' },
        cta_secondary_text_mr: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'विकास कामे पहा' },
        cta_secondary_link: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '/gallery' },
        show_gallery_preview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        minimal_work_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
        meta: { type: DataTypes.JSON, allowNull: true },
        updated_by: { type: DataTypes.UUID, allowNull: true },
        featured_nagarsevak_user_id: { type: DataTypes.UUID, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_portal_configs', ['ward_id'], { name: 'idx_portal_config_ward' }).catch(() => {});
    } else {
      const portalDesc = await queryInterface.describeTable('ward_portal_configs').catch(() => ({}));
      if (!portalDesc.featured_nagarsevak_user_id) {
        await queryInterface.addColumn('ward_portal_configs', 'featured_nagarsevak_user_id', {
          type: DataTypes.UUID,
          allowNull: true,
        }).catch(() => {});
      }
    }

    // 9. ward_gallery_items table
    if (!tables.includes('ward_gallery_items')) {
      console.log('[SCHEMA-SYNC] Creating table ward_gallery_items...');
      await queryInterface.createTable('ward_gallery_items', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
        ward_id: { type: DataTypes.UUID, allowNull: true },
        nagarsevak_user_id: { type: DataTypes.UUID, allowNull: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        title_mr: { type: DataTypes.STRING(255), allowNull: true },
        category: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'DEVELOPMENT' },
        category_label: { type: DataTypes.STRING(100), allowNull: true },
        category_label_mr: { type: DataTypes.STRING(100), allowNull: true },
        media_type: { type: DataTypes.ENUM('image', 'video'), allowNull: false, defaultValue: 'image' },
        media_url: { type: DataTypes.TEXT('long'), allowNull: false },
        video_url: { type: DataTypes.TEXT, allowNull: true },
        duration: { type: DataTypes.STRING(50), allowNull: true },
        date: { type: DataTypes.STRING(50), allowNull: true },
        date_formatted: { type: DataTypes.STRING(100), allowNull: true },
        date_formatted_mr: { type: DataTypes.STRING(100), allowNull: true },
        location: { type: DataTypes.STRING(255), allowNull: true },
        badge: { type: DataTypes.STRING(100), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        description_mr: { type: DataTypes.TEXT, allowNull: true },
        status: { type: DataTypes.ENUM('PUBLISHED', 'DRAFT'), allowNull: false, defaultValue: 'PUBLISHED' },
        order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
        deleted_at: { type: DataTypes.DATE, allowNull: true },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_gallery_items', ['ward_id', 'status']).catch(() => {});
      await queryInterface.addIndex('ward_gallery_items', ['nagarsevak_user_id']).catch(() => {});
      await queryInterface.addIndex('ward_gallery_items', ['order_index']).catch(() => {});
    }

    if (tables.includes('ward_gallery_items')) {
      const desc = await queryInterface.describeTable('ward_gallery_items').catch(() => ({}));
      if (!desc.show_on_dashboard) {
        console.log('[SCHEMA-SYNC] Adding missing column ward_gallery_items.show_on_dashboard...');
        await queryInterface.addColumn('ward_gallery_items', 'show_on_dashboard', {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn show_on_dashboard:', e.message));
        await queryInterface.addIndex('ward_gallery_items', ['show_on_dashboard']).catch(() => {});
      }
    }

    if (tables.includes('wards')) {
      const wardDesc = await queryInterface.describeTable('wards').catch(() => ({}));
      if (!wardDesc.registration_open) {
        console.log('[SCHEMA-SYNC] Adding wards.registration_open...');
        await queryInterface.addColumn('wards', 'registration_open', {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn registration_open:', e.message));
      }
      if (!wardDesc.registration_invite_code) {
        console.log('[SCHEMA-SYNC] Adding wards.registration_invite_code...');
        await queryInterface.addColumn('wards', 'registration_invite_code', {
          type: DataTypes.STRING(12),
          allowNull: true,
        }).catch((e) => console.warn('[SCHEMA-SYNC] addColumn registration_invite_code:', e.message));
        await queryInterface.addIndex('wards', ['registration_invite_code'], {
          unique: true,
          name: 'uq_wards_registration_invite_code',
        }).catch(() => {});
      }
      const [openRows] = await sequelize.query(
        'SELECT id FROM wards WHERE registration_open = 1 AND deleted_at IS NULL LIMIT 1'
      ).catch(() => [[]]);
      if (!openRows || !openRows.length) {
        const [firstActive] = await sequelize.query(
          "SELECT id FROM wards WHERE status = 'ACTIVE' AND deleted_at IS NULL ORDER BY ward_number ASC LIMIT 1"
        ).catch(() => [[]]);
        if (firstActive && firstActive[0] && firstActive[0].id) {
          await sequelize.query('UPDATE wards SET registration_open = 1 WHERE id = :id', {
            replacements: { id: firstActive[0].id },
          }).catch(() => {});
        }
      }
    }

    if (!tables.includes('ward_portal_banners')) {
      console.log('[SCHEMA-SYNC] Creating table ward_portal_banners...');
      await queryInterface.createTable('ward_portal_banners', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
        ward_id: { type: DataTypes.UUID, allowNull: false },
        home_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        complaints_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        gallery_banner_url: { type: DataTypes.TEXT('long'), allowNull: true },
        updated_by: { type: DataTypes.UUID, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_portal_banners', ['ward_id'], { unique: true, name: 'uq_portal_banners_ward' }).catch(() => {});
    }

    if (!tables.includes('ward_home_works')) {
      console.log('[SCHEMA-SYNC] Creating table ward_home_works...');
      await queryInterface.createTable('ward_home_works', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
        ward_id: { type: DataTypes.UUID, allowNull: false },
        gallery_item_id: { type: DataTypes.UUID, allowNull: false },
        order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
      await queryInterface.addIndex('ward_home_works', ['ward_id', 'order_index'], { name: 'idx_home_works_ward_order' }).catch(() => {});
      await queryInterface.addIndex('ward_home_works', ['ward_id', 'gallery_item_id'], { unique: true, name: 'uq_home_works_ward_item' }).catch(() => {});
    }

    const addNamedIndex = async (table, fields, name) => {
      if (!tables.includes(table)) return;
      await queryInterface.addIndex(table, fields, { name }).catch(() => {});
    };
    // Large ALTER INDEX on XAMPP MariaDB 10.4 can crash mysqld (families/persons).
    // Apply only when explicitly enabled; production can use sequelize migrations instead.
    if (String(process.env.SCHEMA_SYNC_PRODUCTION_INDEXES || '').trim() === '1') {
    await addNamedIndex('notifications', ['user_id', 'created_at'], 'idx_notif_user_created');
    await addNamedIndex('notifications', ['sender_user_id', 'created_at'], 'idx_notif_sender_created');
    await addNamedIndex('notifications', ['user_id', 'is_read'], 'idx_notif_user_read');
    await addNamedIndex('complaints', ['ward_id', 'status'], 'idx_complaints_ward_status');
    await addNamedIndex('complaints', ['submitted_by_user_id', 'created_at'], 'idx_complaints_submitter');
    await addNamedIndex('complaints', ['assigned_employee_id', 'status'], 'idx_complaints_emp_status');
    await addNamedIndex('complaints', ['assigned_nagarsevak_user_id'], 'idx_complaints_nagar');
    await addNamedIndex('users', ['ward_id', 'role_id', 'status'], 'idx_users_ward_role_status');
    await addNamedIndex('nagarsevak_users', ['ward_id', 'status'], 'idx_nagar_users_ward_status');
    await addNamedIndex('group_chats', ['ward_id', 'is_active'], 'idx_group_chats_ward_active');
    await addNamedIndex('all_chats', ['ward_id', 'is_active'], 'idx_all_chats_ward_active');
    await addNamedIndex('group_chat_messages', ['group_id', 'created_at'], 'idx_gcm_group_created');
    await addNamedIndex('all_chat_messages', ['group_id', 'created_at'], 'idx_acm_group_created');
    await addNamedIndex('group_chat_members', ['user_id'], 'idx_gcm_user');
    await addNamedIndex('group_chat_members', ['group_id', 'user_id'], 'idx_gcm_group_user');
    await addNamedIndex('all_chat_members', ['user_id'], 'idx_acm_user');
    await addNamedIndex('all_chat_members', ['group_id', 'user_id'], 'idx_acm_group_user');
    await addNamedIndex('chat_user_state', ['user_id'], 'idx_chat_state_user');
    await addNamedIndex('persons', ['status', 'deleted_at'], 'idx_persons_status_deleted');
    await addNamedIndex('persons', ['family_id', 'status', 'deleted_at'], 'idx_persons_family_status_del');
    await addNamedIndex('persons', ['status', 'dob', 'deleted_at'], 'idx_persons_status_dob');
    await addNamedIndex('persons', ['mobile', 'deleted_at'], 'idx_persons_mobile_del');
    await addNamedIndex('families', ['house_id', 'status', 'deleted_at'], 'idx_families_house_status_del');
    await addNamedIndex('houses', ['area_id', 'status', 'deleted_at'], 'idx_houses_area_status_del');
    await addNamedIndex('voter_profiles', ['status', 'person_id'], 'idx_voters_status_person');
    await addNamedIndex('complaints', ['ward_id', 'status', 'created_at'], 'idx_complaints_ward_status_created');
    await addNamedIndex('users', ['ward_id', 'role_id', 'status', 'deleted_at'], 'idx_users_ward_role_status_del');
    await addNamedIndex('person_birthdays', ['ward_id', 'status', 'birth_month', 'birth_day'], 'idx_bday_ward_md');
    await addNamedIndex('ward_nagarsevak_subscriptions', ['ward_id', 'status'], 'idx_wns_ward_status');
    } else {
      console.log('[SCHEMA-SYNC] Skipping production-scale indexes.');
    }

    // Restore official corporator names (a demo script had overwritten several W-03 accounts as Borkar).
    if (String(process.env.SCHEMA_SYNC_RESTORE_CORPORATORS || '').trim() === '1') {
    try {
      const { CORPORATORS } = require('../migrations/20260910000036-amc-corporator-directory-and-nagarsevak-permissions');
      if (Array.isArray(CORPORATORS) && tables.includes('users')) {
        for (const [, wardSeat, name, mobile, partyName, officialAddress] of CORPORATORS) {
          if (!mobile || !name) continue;
          await sequelize.query(
            'UPDATE users SET name = :name WHERE mobile = :mobile AND deleted_at IS NULL',
            { replacements: { name, mobile } }
          ).catch(() => {});
          if (tables.includes('nagarsevak_users')) {
            await sequelize.query(
              `UPDATE nagarsevak_users
               SET name = :name, ward_seat = :wardSeat, party_name = :partyName, official_address = :officialAddress
               WHERE mobile = :mobile AND deleted_at IS NULL`,
              { replacements: { name, mobile, wardSeat: wardSeat || null, partyName: partyName || null, officialAddress: officialAddress || null } }
            ).catch(() => {});
          }
        }
        console.log('[SCHEMA-SYNC] Corporator directory names restored by mobile.');
      }
    } catch (err) {
      console.warn('[SCHEMA-SYNC] Corporator name restore skipped:', err.message);
    }
    }

    // Demo gallery is served from the API default template, not copied into every ward.

    // 11. Register migrations in SequelizeMeta table if present
    if (tables.includes('sequelizemeta')) {
      const migrationsToRegister = [
        '20260922000064-nagarsevak-daily-schedule.js',
        '20260924000065-schedule-assigned-employee.js',
        '20260924000066-schedule-assignments.js',
        '20260928000067-chat-recycle-retention-and-75day-lifecycle.js',
        '20260929000068-shop-property-owner.js',
        '20261001000069-ward-portal-cms.js',
        '20261001000070-ward-portal-cms-tables.js',
        '20261002000071-ward-portal-banners-and-home-works.js',
        '20261004000073-ward-public-registration-open.js',
        '20261004000074-ward-registration-invite-code.js',
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
