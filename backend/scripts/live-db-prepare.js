'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/database');
const { ensureDatabaseSchema } = require('../src/services/schemaSync.service');

const REQUIRED_TABLES = [
  'users',
  'roles',
  'wards',
  'areas',
  'ward_nagarsevak_subscriptions',
  'ward_portal_configs',
  'ward_gallery_items',
  'ward_portal_banners',
  'ward_home_works',
  'complaints',
  'hospitals',
];

const REQUIRED_COLUMNS = {
  ward_nagarsevak_subscriptions: ['resident_visible', 'status', 'ward_id', 'nagarsevak_user_id'],
  ward_portal_configs: ['ward_id', 'hero_banner_url', 'meta', 'featured_nagarsevak_user_id'],
  ward_gallery_items: ['ward_id', 'nagarsevak_user_id', 'show_on_dashboard', 'media_url'],
  complaints: ['assigned_nagarsevak_user_id', 'ward_id', 'status'],
  wards: ['registration_open', 'registration_invite_code', 'status'],
};

function envOk(name, minLen = 1) {
  const v = String(process.env[name] || '').trim();
  return v.length >= minLen;
}

async function registerAppliedMigrations() {
  const dir = path.resolve(__dirname, '../src/migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS SequelizeMeta (
      name VARCHAR(255) NOT NULL PRIMARY KEY
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  let inserted = 0;
  for (const name of files) {
    const [result] = await sequelize.query(
      'INSERT IGNORE INTO SequelizeMeta (name) VALUES (:name)',
      { replacements: { name } }
    );
    if (result?.affectedRows) inserted += 1;
  }
  return { total: files.length, inserted };
}

async function main() {
  const issues = [];
  console.log('[LIVE-DB] Connecting...');
  await sequelize.authenticate();
  console.log('[LIVE-DB] MySQL connected.');

  if (!envOk('JWT_SECRET', 32)) issues.push('JWT_SECRET is missing or shorter than 32 characters.');
  if (!envOk('DB_NAME')) issues.push('DB_NAME is not set.');
  if (!envOk('DB_USER')) issues.push('DB_USER is not set.');

  if (!process.env.SCHEMA_SYNC_PRODUCTION_INDEXES) {
    process.env.SCHEMA_SYNC_PRODUCTION_INDEXES = '1';
  }
  console.log('[LIVE-DB] Applying schema sync and production indexes...');
  const ok = await ensureDatabaseSchema(sequelize);
  if (!ok) issues.push('Schema sync reported an error. Check [SCHEMA-SYNC ERROR] above.');

  const rawTables = await sequelize.getQueryInterface().showAllTables();
  const tables = new Set(rawTables.map((t) => String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase()));

  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) issues.push(`Missing table: ${table}`);
  }

  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    if (!tables.has(table)) continue;
    const desc = await sequelize.getQueryInterface().describeTable(table);
    for (const col of cols) {
      if (!desc[col]) issues.push(`Missing column: ${table}.${col}`);
    }
  }

  if (tables.has('users') && tables.has('wards')) {
    const registered = await registerAppliedMigrations();
    console.log(`[LIVE-DB] SequelizeMeta: ${registered.total} migrations tracked (${registered.inserted} newly marked).`);
  } else {
    issues.push('Core users/wards tables missing. Run npm run migrate on an empty database, then seed roles only.');
  }

  const counts = {};
  const queries = {
    wards: 'SELECT COUNT(*) AS n FROM wards WHERE deleted_at IS NULL',
    roles: 'SELECT COUNT(*) AS n FROM roles',
    admins: "SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'SUPER_ADMIN' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL",
    nagarsevaks: "SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'NAGARSEVAK' AND u.deleted_at IS NULL",
    activePanels: "SELECT COUNT(*) AS n FROM ward_nagarsevak_subscriptions WHERE status = 'ACTIVE'",
    shownPanels: 'SELECT COUNT(*) AS n FROM ward_nagarsevak_subscriptions WHERE status = \'ACTIVE\' AND resident_visible = 1',
    portalConfigs: 'SELECT COUNT(*) AS n FROM ward_portal_configs',
  };
  for (const [key, sql] of Object.entries(queries)) {
    try {
      const [row] = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
      counts[key] = Number(row?.n || 0);
    } catch (err) {
      counts[key] = null;
      issues.push(`${key} count failed: ${err.message}`);
    }
  }

  if (!counts.admins) issues.push('No ACTIVE SUPER_ADMIN user found. Create one before going live.');
  if (!counts.roles) issues.push('Roles table is empty.');
  if (!counts.wards) issues.push('Wards table is empty.');

  console.log('[LIVE-DB] Counts', counts);
  console.log('[LIVE-DB] NODE_ENV=', process.env.NODE_ENV || 'development');
  console.log('[LIVE-DB] JWT_SECRET set=', envOk('JWT_SECRET', 32));
  console.log('[LIVE-DB] CORS_ORIGIN set=', Boolean(String(process.env.CORS_ORIGIN || '').trim()));

  if (issues.length) {
    console.error('[LIVE-DB] ISSUES');
    for (const issue of issues) console.error(' -', issue);
    process.exitCode = 1;
  } else {
    console.log('[LIVE-DB] Schema and required live tables look ready. Do not run demo seed on this database.');
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error('[LIVE-DB FAILED]', err.message);
  process.exit(1);
});
