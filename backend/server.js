require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');
require('./src/models'); // ensures all associations are registered before first query

const PORT = process.env.PORT || 4000;
const { cleanupAuditLogs, cleanupRecycleBin } = require('./src/v2/controllers/maintenance.controller');
const { archiveOldSchedules } = require('./src/v2/controllers/schedule.controller');
const { cleanupOldMessages } = require('./src/v2/controllers/chat.controller');
const { notifyExpiredNagarsevakSubscriptions } = require('./src/services/wardActivation.service');
const { notifyTodayDeathReminders, notifyTodayBirthdays } = require('./src/services/wardDay.service');
const { closeResolvedOvernight, archiveOldComplaints } = require('./src/v2/controllers/complaint.controller');
const { ensureDatabaseSchema } = require('./src/services/schemaSync.service');

async function start() {
  try {
    await sequelize.authenticate();
    console.log('MySQL connection established.');
    const schemaJob = ensureDatabaseSchema(sequelize).catch((e) => {
      console.warn('[SCHEMA-SYNC]', e.message);
    });
    await Promise.race([
      schemaJob,
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);

    const server = app.listen(PORT, () => {
      console.log(`Ward Management API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
      // Lightweight hourly maintenance: audit logs older than 2 days and recycle records older than 60 days are removed automatically.
      const runMaintenance = async () => {
        try {
          const a=await cleanupAuditLogs(2);
          const r=await cleanupRecycleBin(60);
          const sched=await archiveOldSchedules().catch(()=>0);
          const c=await cleanupOldMessages();
          const s=await notifyExpiredNagarsevakSubscriptions().catch(()=>0);
          const d=await notifyTodayDeathReminders().catch(()=>0);
          const b=await notifyTodayBirthdays().catch(()=>0);
          const closed=await closeResolvedOvernight().catch(()=>0);
          const compArchived=await archiveOldComplaints(60).catch(()=>0);
          if(a||r||c||s||d||b||closed||sched||compArchived) console.log(`[MAINTENANCE] removed audit=${a}, recycle=${r}, schedule-archive=${sched||0}, complaint-archive=${compArchived||0}, chat=${c||0}, subscriptions-notified=${s||0}, death-reminders=${d||0}, birthday-reminders=${b||0}, auto-closed=${closed||0}`);
        } catch(e) { console.error('[MAINTENANCE FAILURE]',e.message); }
      };
      runMaintenance();
      setInterval(runMaintenance, 60*60*1000).unref();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[PORT CONFLICT] Port ${PORT} is already in use by another running instance.`);
        console.error(`To release port ${PORT} on Windows, run:\n  npm run kill:port\n`);
        process.exit(1);
      } else {
        console.error('[SERVER ERROR]', err);
      }
    });

    const shutdown = () => {
      console.log('Shutting down server gracefully...');
      server.close(() => {
        sequelize.close().then(() => {
          console.log('Database connections closed.');
          process.exit(0);
        }).catch(() => process.exit(0));
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Unable to start server - database connection failed:', err.message);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

start();
