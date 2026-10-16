'use strict';
require('dotenv').config();
const sequelize = require('../src/config/database');
const { repairChatUserForeignKeys } = require('../src/services/schemaSync.service');

(async () => {
  await sequelize.authenticate();
  const raw = await sequelize.getQueryInterface().showAllTables();
  const tables = raw.map((t) =>
    String(typeof t === 'string' ? t : t.tableName || t.name || '').toLowerCase()
  );
  await repairChatUserForeignKeys(sequelize, tables);

  const orphans = await sequelize.query(
    `SELECT COUNT(*) AS c
     FROM all_chat_messages m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE u.id IS NULL`,
    { type: sequelize.QueryTypes.SELECT }
  );
  const fks = await sequelize.query(
    `SELECT k.TABLE_NAME, k.COLUMN_NAME, k.CONSTRAINT_NAME, rc.DELETE_RULE
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
      AND rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = DATABASE()
       AND k.TABLE_NAME IN ('all_chat_messages','group_chat_messages')
       AND k.REFERENCED_TABLE_NAME = 'users'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  console.log(JSON.stringify({ orphans, fks }, null, 2));
  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
