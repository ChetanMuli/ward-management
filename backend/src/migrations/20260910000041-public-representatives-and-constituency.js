'use strict';

const crypto = require('crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Public-representative login roles are intentionally separate from
    // ward-scoped Nagarsevak/employee roles. MLA/MP receive city-wide access.
    await queryInterface.sequelize.query(
      "ALTER TABLE roles MODIFY name ENUM('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN','SOCIAL_WORKER','CANDIDATE','MLA','MP') NOT NULL"
    );

    // Add constituency column if it does not already exist.
    const userDesc = await queryInterface.describeTable('users');

    if (!userDesc.constituency) {
      await queryInterface.addColumn('users', 'constituency', {
        type: DataTypes.STRING(180),
        allowNull: true,
      });
    }

    const now = new Date();

    // Find existing MLA / MP roles.
    const roles = await queryInterface.sequelize.query(
      "SELECT id, name FROM roles WHERE name IN ('MLA','MP')",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const roleMap = Object.fromEntries(
      roles.map((role) => [role.name, role.id])
    );

    // Create missing MLA / MP roles.
    for (const [name, description] of [
      ['MLA', 'Public representative - Member of Legislative Assembly'],
      ['MP', 'Public representative - Member of Parliament'],
    ]) {
      if (!roleMap[name]) {
        const id = crypto.randomUUID();

        await queryInterface.bulkInsert('roles', [
          {
            id,
            name,
            description,
            created_at: now,
            updated_at: now,
          },
        ]);

        roleMap[name] = id;
      }
    }

    /*
     * Public representative permissions.
     *
     * MLA and MP are city-wide representatives, so they do not receive
     * a specific ward assignment.
     *
     * IMPORTANT:
     * users.ward_ids is NOT NULL in the existing production database.
     * Therefore city-wide representatives use an empty JSON array [].
     *
     * The application-level wardScope logic treats MLA/MP as city-wide
     * representatives and therefore does not restrict them to ward_ids.
     */
    const representativePermissions = JSON.stringify([
      'VIEW_DASHBOARD',
      'VIEW_WARDS',
      'VIEW_WARD_INFORMATION',
      'VIEW_ELECTION_DATA',
      'VIEW_WARD_UPDATES',
      'VIEW_NOTIFICATIONS',
      'VIEW_HOUSES',
      'VIEW_FAMILIES',
      'VIEW_CITIZENS',
      'VIEW_VOTERS',
      'VIEW_COMPLAINTS',
      'VIEW_BIRTHDAYS',
      'VIEW_SCHEMES',
      'EXPORT_DATA',
      'VIEW_CHAT',
      'SEND_CHAT',
    ]);

    // Check whether the default representative accounts already exist.
    const existing = await queryInterface.sequelize.query(
      "SELECT email FROM users WHERE email IN ('mla@warddesk.local','mp@warddesk.local')",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const existingEmails = new Set(
      existing.map((row) => row.email)
    );

    /*
     * Default public representative profiles.
     *
     * Login is disabled initially because password_hash is NULL.
     * Master Admin can configure the password from the
     * Public Representatives module.
     */
    const seeds = [
      {
        id: crypto.randomUUID(),
        name: 'Sangram Arun Jagtap',
        email: 'mla@warddesk.local',
        mobile: null,

        role_id: roleMap.MLA,

        ward_id: null,

        // REQUIRED because users.ward_ids is NOT NULL.
        // MLA is city-wide, so no specific ward IDs are assigned.
        ward_ids: JSON.stringify([]),

        permissions: representativePermissions,

        constituency: 'Ahilyanagar City Assembly Constituency',

        party_name: 'Nationalist Congress Party',

        official_address: null,

        password_hash: null,

        status: 'ACTIVE',

        two_factor_enabled: false,

        last_login_at: null,

        person_id: null,

        deleted_at: null,

        created_at: now,
        updated_at: now,
      },

      {
        id: crypto.randomUUID(),
        name: 'Nilesh Dnyandev Lanke',
        email: 'mp@warddesk.local',
        mobile: '9881618202',

        role_id: roleMap.MP,

        ward_id: null,

        // REQUIRED because users.ward_ids is NOT NULL.
        // MP is city-wide, so no specific ward IDs are assigned.
        ward_ids: JSON.stringify([]),

        permissions: representativePermissions,

        constituency: 'Ahmednagar Lok Sabha Constituency',

        party_name:
          'Nationalist Congress Party - Sharadchandra Pawar',

        official_address:
          'Hanga, Parner, Ahmednagar, Maharashtra',

        password_hash: null,

        status: 'ACTIVE',

        two_factor_enabled: false,

        last_login_at: null,

        person_id: null,

        deleted_at: null,

        created_at: now,
        updated_at: now,
      },
    ];

    // Only insert representative accounts that do not already exist.
    const rows = seeds.filter(
      (row) => !existingEmails.has(row.email)
    );

    if (rows.length > 0) {
      await queryInterface.bulkInsert('users', rows);
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('users');

    /*
     * Keep MLA/MP profile/login data non-destructive on rollback.
     * Only remove the constituency column introduced by this migration.
     */
    if (desc.constituency) {
      await queryInterface.removeColumn(
        'users',
        'constituency'
      );
    }

    /*
     * Do not remove MLA/MP enum values on rollback.
     *
     * This is intentional because representative accounts may already
     * exist after the migration has been applied.
     */
  },
};
