require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');
require('./src/models'); // ensures all associations are registered before first query

const PORT = process.env.PORT || 4000;
const { cleanupAuditLogs, cleanupRecycleBin } = require('./src/v2/controllers/maintenance.controller');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connection established.');

    app.listen(PORT, () => {
      console.log(`Ward Management API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      // Lightweight hourly maintenance: audit logs older than 2 days and recycle records older than 30 days are removed automatically.
      const runMaintenance = async () => { try { const a=await cleanupAuditLogs(2); const r=await cleanupRecycleBin(30); if(a||r) console.log(`[MAINTENANCE] removed audit=${a}, recycle=${r}`); } catch(e) { console.error('[MAINTENANCE FAILURE]',e.message); } };
      runMaintenance();
      setInterval(runMaintenance, 60*60*1000).unref();
    });
  } catch (err) {
    console.error('Unable to start server - database connection failed:', err.message);
    process.exit(1);
  }
}

start();
