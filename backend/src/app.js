require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

// --- Security & platform middleware (SRS section 27) ---
app.use(helmet());
const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
function isPrivateHostname(hostname){
  if(!hostname) return false;
  if(hostname==='localhost'||hostname==='127.0.0.1'||hostname==='::1'||hostname==='[::1]') return true;
  if(/^(10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if(/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if(/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}
function originAllowed(origin){
  if(!origin) return true;
  const normalized=String(origin).trim().replace(/\/$/,'');
  if(corsOrigins.includes('*')||corsOrigins.includes(normalized)||corsOrigins.includes(origin)) return true;
  if((process.env.NODE_ENV||'development')==='production') return false;
  try{
    const {hostname,protocol}=new URL(normalized);
    return (protocol==='http:'||protocol==='https:') && isPrivateHostname(hostname);
  }catch{
    return false;
  }
}
app.use(cors({
  origin: (origin, callback) => {
    if (originAllowed(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// General API rate limit; auth routes carry their own tighter limiter.
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api', routes);
app.use('/api/v2', require('./v2/routes'));

app.use(notFound);
app.use(errorHandler);

// Lightweight housekeeping: audit logs older than 2 days and recycle-bin data older than 30 days are removed automatically.
try {
  const { cleanupAuditLogs, cleanupRecycleBin } = require('./v2/controllers/maintenance.controller');
  const { archiveOldSchedules } = require('./v2/controllers/schedule.controller');
  const runMaintenance=()=>Promise.all([cleanupAuditLogs(2),cleanupRecycleBin(30),archiveOldSchedules()]).catch(()=>{});
  runMaintenance();
  setInterval(runMaintenance,24*60*60*1000).unref?.();
} catch (_) {}

module.exports = app;
