'use strict';
require('dotenv').config();
const sequelize = require('../src/config/database');

const CLEANUPS = [
  `DELETE m FROM all_chat_messages m LEFT JOIN users u ON u.id = m.sender_user_id WHERE u.id IS NULL`,
  `DELETE m FROM all_chat_messages m LEFT JOIN users u ON u.id = m.recipient_user_id WHERE m.recipient_user_id IS NOT NULL AND u.id IS NULL`,
  `DELETE m FROM all_chat_members m LEFT JOIN users u ON u.id = m.user_id WHERE u.id IS NULL`,
  `DELETE m FROM group_chat_messages m LEFT JOIN users u ON u.id = m.sender_user_id WHERE u.id IS NULL`,
  `DELETE m FROM group_chat_members m LEFT JOIN users u ON u.id = m.user_id WHERE u.id IS NULL`,
  `DELETE s FROM chat_user_state s LEFT JOIN users u ON u.id = s.user_id WHERE u.id IS NULL`,
  `UPDATE nagarsevak_schedules SET assigned_employee_user_id = NULL
     WHERE assigned_employee_user_id IS NOT NULL
       AND assigned_employee_user_id NOT IN (SELECT id FROM users)`,
];

async function run() {
  await sequelize.authenticate();
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const result = {};
  for (const sql of CLEANUPS) {
    try {
      const [, meta] = await sequelize.query(sql);
      result[sql.slice(0, 70)] = meta?.affectedRows ?? meta;
    } catch (e) {
      result[sql.slice(0, 70)] = e.message;
    }
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log(JSON.stringify(result, null, 2));
  await sequelize.close();
}

run().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
