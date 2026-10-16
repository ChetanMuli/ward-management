'use strict';
require('dotenv').config();
const sequelize = require('../src/config/database');

const TABLES = [
  'complaint_histories',
  'complaint_attachments',
  'complaints',
  'person_birthdays',
  'death_observances',
  'death_records',
  'person_documents',
  'voter_profiles',
  'persons',
  'families',
  'houses',
  'apartments',
];

async function countIfExists(table) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] }
  );
  if (!Number(rows[0]?.c)) return null;
  const [cnt] = await sequelize.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return Number(cnt[0]?.c || 0);
}

async function run() {
  await sequelize.authenticate();
  const before = {};
  for (const t of TABLES) before[t] = await countIfExists(t);

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const [userCols] = await sequelize.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users'
       AND COLUMN_NAME IN ('person_id','personId')`
  );
  if (userCols.some((c) => c.COLUMN_NAME === 'person_id')) {
    await sequelize.query('UPDATE users SET person_id = NULL WHERE person_id IS NOT NULL');
  }
  for (const table of TABLES) {
    if (before[table] == null) continue;
    await sequelize.query(`TRUNCATE TABLE \`${table}\``);
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  const staff = await sequelize.query(
    `SELECT r.name AS role, COUNT(*) AS c
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK','EMPLOYEE')
     GROUP BY r.name`,
    { type: sequelize.QueryTypes.SELECT }
  );

  const after = {};
  for (const table of TABLES) after[table] = await countIfExists(table);

  console.log(JSON.stringify({ before, after, staffKept: staff }, null, 2));
  await sequelize.close();
}

run().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
