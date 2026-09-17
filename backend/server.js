require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');
require('./src/models'); // ensures all associations are registered before first query

const PORT = process.env.PORT || 4000;
const { cleanupAuditLogs, cleanupRecycleBin } = require('./src/v2/controllers/maintenance.controller');
const { cleanupOldMessages } = require('./src/v2/controllers/chat.controller');
const { notifyExpiredNagarsevakSubscriptions } = require('./src/services/wardActivation.service');
const { notifyTodayDeathReminders } = require('./src/services/wardDay.service');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connection established.');

    app.listen(PORT, () => {
      console.log(`Ward Management API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      // Lightweight hourly maintenance: audit logs older than 2 days and recycle records older than 30 days are removed automatically.
      const runMaintenance = async () => {
        try {
          const a=await cleanupAuditLogs(2);
          const r=await cleanupRecycleBin(30);
          const c=await cleanupOldMessages();
          const s=await notifyExpiredNagarsevakSubscriptions().catch(()=>0);
          const d=await notifyTodayDeathReminders().catch(()=>0);
          if(a||r||c||s||d) console.log(`[MAINTENANCE] removed audit=${a}, recycle=${r}, chat=${c||0}, subscriptions-notified=${s||0}, death-reminders=${d||0}`);
        } catch(e) { console.error('[MAINTENANCE FAILURE]',e.message); }
      };
      runMaintenance();
      setInterval(runMaintenance, 60*60*1000).unref();
    });
  } catch (err) {
    console.error('Unable to start server - database connection failed:', err.message);
    process.exit(1);
  }
}

start();
