'use strict';

require('dotenv').config();
const sequelize = require('../src/config/database');
const { ensureDatabaseSchema } = require('../src/services/schemaSync.service');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('[ENSURE-SCHEMA] Connected to database.');
    await ensureDatabaseSchema(sequelize);
    console.log('[ENSURE-SCHEMA] All schema checks and updates applied.');
    process.exit(0);
  } catch (err) {
    console.error('[ENSURE-SCHEMA FAILED]', err.message);
    process.exit(1);
  }
}

main();
