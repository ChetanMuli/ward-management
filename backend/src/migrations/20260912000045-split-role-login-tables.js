'use strict';

async function addIndexIfMissing(queryInterface, table, fields, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT INDEX_NAME FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = :table AND index_name = :name
     LIMIT 1`,
    { replacements: { table, name } }
  );
  if (!rows.length) await queryInterface.addIndex(table, fields, { name });
}

async function createLoginTable(queryInterface, Sequelize, tableName, extra = {}) {
  const tables = await queryInterface.showAllTables();
  const names = tables.map(t => (typeof t === 'string' ? t : t.tableName || t.name || '')).map(n => String(n).toLowerCase());
  if (names.includes(tableName.toLowerCase())) {
    await queryInterface.dropTable(tableName);
  }
  const { DataTypes } = Sequelize;
  await queryInterface.createTable(tableName, {
    id: { type: DataTypes.UUID, primaryKey: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    mobile: { type: DataTypes.STRING },
    password_hash: { type: DataTypes.STRING },
    status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'), allowNull: false, defaultValue: 'ACTIVE' },
    two_factor_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    last_login_at: { type: DataTypes.DATE, allowNull: true },
    ward_id: { type: DataTypes.UUID, allowNull: true },
    ...extra,
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });
  await addIndexIfMissing(queryInterface, tableName, ['email'], `${tableName}_email_idx`);
  await addIndexIfMissing(queryInterface, tableName, ['mobile'], `${tableName}_mobile_idx`);
  await addIndexIfMissing(queryInterface, tableName, ['status'], `${tableName}_status_idx`);
  await addIndexIfMissing(queryInterface, tableName, ['ward_id'], `${tableName}_ward_id_idx`);
  await addIndexIfMissing(queryInterface, tableName, ['status', 'ward_id'], `${tableName}_status_ward_idx`);
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;

    await createLoginTable(queryInterface, Sequelize, 'admin_users');
    await createLoginTable(queryInterface, Sequelize, 'sub_admin_users', {
      permissions: { type: DataTypes.JSON, allowNull: false },
      ward_ids: { type: DataTypes.JSON, allowNull: false },
    });
    await createLoginTable(queryInterface, Sequelize, 'nagarsevak_users', {
      permissions: { type: DataTypes.JSON, allowNull: false },
      ward_seat: { type: DataTypes.STRING, allowNull: true },
      party_name: { type: DataTypes.STRING, allowNull: true },
      official_address: { type: DataTypes.TEXT, allowNull: true },
    });
    await createLoginTable(queryInterface, Sequelize, 'employee_users');
    await createLoginTable(queryInterface, Sequelize, 'citizen_users', {
      person_id: { type: DataTypes.UUID, allowNull: true },
    });
    await createLoginTable(queryInterface, Sequelize, 'community_users', {
      permissions: { type: DataTypes.JSON, allowNull: false },
      member_role: { type: DataTypes.ENUM('SOCIAL_WORKER', 'CANDIDATE'), allowNull: false, defaultValue: 'SOCIAL_WORKER' },
    });

    const copyBase = `u.id, u.name, u.email, u.mobile, u.password_hash, u.status, u.two_factor_enabled, u.last_login_at, u.ward_id, u.created_at, u.updated_at, u.deleted_at`;

    await queryInterface.sequelize.query(
      `INSERT INTO admin_users (id, name, email, mobile, password_hash, status, two_factor_enabled, last_login_at, ward_id, created_at, updated_at, deleted_at)
       SELECT ${copyBase} FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'SUPER_ADMIN'`
    );
    await queryInterface.sequelize.query(
      `INSERT INTO sub_admin_users (id, name, email, mobile, password_hash, status, two_factor_enabled, last_login_at, ward_id, permissions, ward_ids, created_at, updated_at, deleted_at)
       SELECT u.id, u.name, u.email, u.mobile, u.password_hash, u.status, u.two_factor_enabled, u.last_login_at, u.ward_id,
              IFNULL(NULLIF(u.permissions,''),'[]'), IFNULL(NULLIF(u.ward_ids,''),'[]'),
              u.created_at, u.updated_at, u.deleted_at
       FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'SUB_MASTER_ADMIN'`
    );
    await queryInterface.sequelize.query(
      `INSERT INTO nagarsevak_users (id, name, email, mobile, password_hash, status, two_factor_enabled, last_login_at, ward_id, permissions, ward_seat, party_name, official_address, created_at, updated_at, deleted_at)
       SELECT u.id, u.name, u.email, u.mobile, u.password_hash, u.status, u.two_factor_enabled, u.last_login_at, u.ward_id,
              IFNULL(NULLIF(u.permissions,''),'[]'), u.ward_seat, u.party_name, u.official_address,
              u.created_at, u.updated_at, u.deleted_at
       FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'NAGARSEVAK'`
    );
    await queryInterface.sequelize.query(
      `INSERT INTO employee_users (id, name, email, mobile, password_hash, status, two_factor_enabled, last_login_at, ward_id, created_at, updated_at, deleted_at)
       SELECT ${copyBase} FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'EMPLOYEE'`
    );
    await queryInterface.sequelize.query(
      `INSERT INTO citizen_users (id, name, email, mobile, password_hash, status, two_factor_enabled, last_login_at, ward_id, person_id, created_at, updated_at, deleted_at)
       SELECT u.id, u.name, u.email, u.mobile, u.password_hash, u.status, u.two_factor_enabled, u.last_login_at, u.ward_id, u.person_id, u.created_at, u.updated_at, u.deleted_at
       FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'CITIZEN'`
    );
    await queryInterface.sequelize.query(
      `INSERT INTO community_users (id, name, email, mobile, password_hash, status, two_factor_enabled, last_login_at, ward_id, permissions, member_role, created_at, updated_at, deleted_at)
       SELECT u.id, u.name, u.email, u.mobile, u.password_hash, u.status, u.two_factor_enabled, u.last_login_at, u.ward_id,
              IFNULL(NULLIF(u.permissions,''),'[]'), r.name, u.created_at, u.updated_at, u.deleted_at
       FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name IN ('SOCIAL_WORKER','CANDIDATE')`
    );

    const userColumns = ['password_hash', 'permissions', 'ward_ids', 'ward_seat', 'party_name', 'official_address'];
    for (const column of userColumns) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT COLUMN_NAME FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = :column LIMIT 1`,
        { replacements: { column } }
      );
      if (exists.length) await queryInterface.removeColumn('users', column);
    }

    await addIndexIfMissing(queryInterface, 'users', ['role_id', 'status', 'ward_id'], 'users_role_status_ward_idx');
    await addIndexIfMissing(queryInterface, 'users', ['status', 'deleted_at'], 'users_status_deleted_idx');
    await addIndexIfMissing(queryInterface, 'complaints', ['ward_id', 'status'], 'complaints_ward_status_idx');
    await addIndexIfMissing(queryInterface, 'complaints', ['assigned_nagarsevak_user_id', 'status'], 'complaints_nagarsevak_status_idx');
    await addIndexIfMissing(queryInterface, 'complaints', ['assigned_employee_id', 'status'], 'complaints_employee_status_idx');
    await addIndexIfMissing(queryInterface, 'houses', ['area_id', 'status'], 'houses_area_status_idx');
    await addIndexIfMissing(queryInterface, 'persons', ['family_id', 'status'], 'persons_family_status_idx');
    await addIndexIfMissing(queryInterface, 'families', ['house_id', 'status'], 'families_house_status_idx');
    await addIndexIfMissing(queryInterface, 'notifications', ['user_id', 'created_at'], 'notifications_user_created_idx');
    await addIndexIfMissing(queryInterface, 'employees', ['ward_id', 'status'], 'employees_ward_status_idx');
    await addIndexIfMissing(queryInterface, 'employees', ['manager_user_id', 'status'], 'employees_manager_status_idx');
    await addIndexIfMissing(queryInterface, 'ward_updates', ['ward_id', 'created_at'], 'ward_updates_ward_created_idx');
    await addIndexIfMissing(queryInterface, 'schemes', ['ward_id', 'status'], 'schemes_ward_status_idx');
    await addIndexIfMissing(queryInterface, 'audit_logs', ['user_id', 'created_at'], 'audit_logs_user_created_idx');
  },

  down: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    await queryInterface.addColumn('users', 'password_hash', { type: DataTypes.STRING });
    await queryInterface.addColumn('users', 'permissions', { type: DataTypes.JSON, allowNull: false, defaultValue: [] });
    await queryInterface.addColumn('users', 'ward_ids', { type: DataTypes.JSON, allowNull: false, defaultValue: [] });
    await queryInterface.addColumn('users', 'ward_seat', { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'party_name', { type: DataTypes.STRING, allowNull: true });
    await queryInterface.addColumn('users', 'official_address', { type: DataTypes.TEXT, allowNull: true });

    await queryInterface.sequelize.query(
      `UPDATE users u
       LEFT JOIN admin_users a ON a.id = u.id
       LEFT JOIN sub_admin_users s ON s.id = u.id
       LEFT JOIN nagarsevak_users n ON n.id = u.id
       LEFT JOIN employee_users e ON e.id = u.id
       LEFT JOIN citizen_users c ON c.id = u.id
       LEFT JOIN community_users m ON m.id = u.id
       SET u.password_hash = COALESCE(a.password_hash,s.password_hash,n.password_hash,e.password_hash,c.password_hash,m.password_hash),
           u.permissions = COALESCE(s.permissions,n.permissions,m.permissions, JSON_ARRAY()),
           u.ward_ids = COALESCE(s.ward_ids, JSON_ARRAY()),
           u.ward_seat = n.ward_seat,
           u.party_name = n.party_name,
           u.official_address = n.official_address`
    );

    await queryInterface.dropTable('community_users');
    await queryInterface.dropTable('citizen_users');
    await queryInterface.dropTable('employee_users');
    await queryInterface.dropTable('nagarsevak_users');
    await queryInterface.dropTable('sub_admin_users');
    await queryInterface.dropTable('admin_users');
  },
};
