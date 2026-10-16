'use strict';
require('dotenv').config();
const sequelize = require('../src/config/database');

async function tableExists(table) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    { replacements: [table] }
  );
  return Number(rows[0]?.c) > 0;
}

async function countTable(table) {
  if (!(await tableExists(table))) return null;
  const [cnt] = await sequelize.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return Number(cnt[0]?.c || 0);
}

async function run() {
  await sequelize.authenticate();

  const before = {
    shops: await countTable('shops_and_offices'),
    employees: await countTable('employees'),
    employeeUsers: await countTable('employee_users'),
    citizenUsers: await countTable('citizen_users'),
    persons: await countTable('persons'),
  };

  const roleCountsBefore = await sequelize.query(
    `SELECT r.name AS role, COUNT(*) AS c
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     GROUP BY r.name`,
    { type: sequelize.QueryTypes.SELECT }
  );

  const empCitizenIds = await sequelize.query(
    `SELECT u.id
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('EMPLOYEE','CITIZEN')`,
    { type: sequelize.QueryTypes.SELECT }
  );
  const ids = empCitizenIds.map((r) => r.id);

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

  if (await tableExists('shops_and_offices')) {
    await sequelize.query('TRUNCATE TABLE `shops_and_offices`');
  }
  if (await tableExists('employee_area_assignments')) {
    await sequelize.query('TRUNCATE TABLE `employee_area_assignments`');
  }
  if (await tableExists('employees')) {
    await sequelize.query('TRUNCATE TABLE `employees`');
  }
  if (await tableExists('employee_users')) {
    await sequelize.query('TRUNCATE TABLE `employee_users`');
  }
  if (await tableExists('citizen_users')) {
    await sequelize.query('TRUNCATE TABLE `citizen_users`');
  }
  if (await tableExists('persons')) {
    await sequelize.query('TRUNCATE TABLE `persons`');
  }
  if (await tableExists('person_birthdays')) {
    await sequelize.query('TRUNCATE TABLE `person_birthdays`');
  }
  if (await tableExists('voter_profiles')) {
    await sequelize.query('TRUNCATE TABLE `voter_profiles`');
  }

  if (await tableExists('nagarsevak_schedules')) {
    const [cols] = await sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'nagarsevak_schedules'
         AND COLUMN_NAME = 'assigned_employee_user_id'`
    );
    if (cols.length) {
      await sequelize.query('UPDATE nagarsevak_schedules SET assigned_employee_user_id = NULL');
    }
  }

  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const memberTables = [
      ['all_chat_members', 'user_id'],
      ['group_chat_members', 'user_id'],
      ['chat_user_state', 'user_id'],
      ['notifications', 'user_id'],
      ['notifications', 'sender_id'],
    ];
    for (const [table, col] of memberTables) {
      if (!(await tableExists(table))) continue;
      const [hasCol] = await sequelize.query(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND COLUMN_NAME = ?`,
        { replacements: [table, col] }
      );
      if (!Number(hasCol[0]?.c)) continue;
      await sequelize.query(
        `DELETE FROM \`${table}\` WHERE \`${col}\` IN (${placeholders})`,
        { replacements: ids }
      );
    }
  }

  await sequelize.query(
    `DELETE u FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('EMPLOYEE','CITIZEN')`
  );

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  const after = {
    shops: await countTable('shops_and_offices'),
    employees: await countTable('employees'),
    employeeUsers: await countTable('employee_users'),
    citizenUsers: await countTable('citizen_users'),
    persons: await countTable('persons'),
  };
  const roleCountsAfter = await sequelize.query(
    `SELECT r.name AS role, COUNT(*) AS c
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     GROUP BY r.name`,
    { type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ before, after, roleCountsBefore, roleCountsAfter }, null, 2));
  await sequelize.close();
}

run().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
