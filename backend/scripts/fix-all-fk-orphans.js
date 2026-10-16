'use strict';
require('dotenv').config();
const sequelize = require('../src/config/database');

async function fkList() {
  return sequelize.query(
    `SELECT
       k.TABLE_NAME AS child_table,
       k.COLUMN_NAME AS child_column,
       k.REFERENCED_TABLE_NAME AS parent_table,
       k.REFERENCED_COLUMN_NAME AS parent_column,
       k.CONSTRAINT_NAME AS constraint_name,
       c.IS_NULLABLE AS is_nullable,
       rc.DELETE_RULE AS delete_rule
     FROM information_schema.KEY_COLUMN_USAGE k
     JOIN information_schema.COLUMNS c
       ON c.TABLE_SCHEMA = k.TABLE_SCHEMA
      AND c.TABLE_NAME = k.TABLE_NAME
      AND c.COLUMN_NAME = k.COLUMN_NAME
     JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON rc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
      AND rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME
     WHERE k.TABLE_SCHEMA = DATABASE()
       AND k.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY k.TABLE_NAME, k.COLUMN_NAME`,
    { type: sequelize.QueryTypes.SELECT }
  );
}

async function orphanCount(fk) {
  const [row] = await sequelize.query(
    `SELECT COUNT(*) AS c
     FROM \`${fk.child_table}\` c
     LEFT JOIN \`${fk.parent_table}\` p
       ON p.\`${fk.parent_column}\` = c.\`${fk.child_column}\`
     WHERE c.\`${fk.child_column}\` IS NOT NULL
       AND p.\`${fk.parent_column}\` IS NULL`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return Number(row?.c || 0);
}

async function cleanFk(fk) {
  const count = await orphanCount(fk);
  if (!count) return 0;
  const nullable = String(fk.is_nullable || '').toUpperCase() === 'YES';
  if (nullable) {
    await sequelize.query(
      `UPDATE \`${fk.child_table}\` c
       LEFT JOIN \`${fk.parent_table}\` p
         ON p.\`${fk.parent_column}\` = c.\`${fk.child_column}\`
       SET c.\`${fk.child_column}\` = NULL
       WHERE c.\`${fk.child_column}\` IS NOT NULL
         AND p.\`${fk.parent_column}\` IS NULL`
    );
  } else {
    await sequelize.query(
      `DELETE c FROM \`${fk.child_table}\` c
       LEFT JOIN \`${fk.parent_table}\` p
         ON p.\`${fk.parent_column}\` = c.\`${fk.child_column}\`
       WHERE c.\`${fk.child_column}\` IS NOT NULL
         AND p.\`${fk.parent_column}\` IS NULL`
    );
  }
  return count;
}

(async () => {
  await sequelize.authenticate();
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const fks = await fkList();
  const cleaned = [];
  for (const fk of fks) {
    try {
      const n = await cleanFk(fk);
      if (n) cleaned.push({ ...fk, orphans: n, action: String(fk.is_nullable).toUpperCase() === 'YES' ? 'SET NULL' : 'DELETE' });
    } catch (e) {
      cleaned.push({ ...fk, error: e.message });
    }
  }
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

  const remaining = [];
  for (const fk of fks) {
    try {
      const n = await orphanCount(fk);
      if (n) remaining.push({ table: fk.child_table, column: fk.child_column, orphans: n });
    } catch (e) {
      remaining.push({ table: fk.child_table, column: fk.child_column, error: e.message });
    }
  }

  console.log(JSON.stringify({ cleaned, remaining }, null, 2));
  await sequelize.close();
})().catch(async (e) => {
  console.error(e);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
