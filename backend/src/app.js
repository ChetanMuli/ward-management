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
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
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

// Public client presentation and documentation download routes
const docFolder = require('path').resolve(__dirname, '../../documentation');
app.get(['/download/presentation', '/api/v2/docs/download/presentation'], (req, res) => {
  res.download(require('path').join(docFolder, 'Ward_Management_System_Client_Presentation.pptx'), 'Ward_Management_System_Client_Presentation.pptx');
});
app.get(['/download/pdf', '/download/documentation', '/api/v2/docs/download/pdf'], (req, res) => {
  res.download(require('path').join(docFolder, 'Ward_Management_System_Complete_Documentation.pdf'), 'Ward_Management_System_Complete_Documentation.pdf');
});
app.get(['/download/presentation-mr', '/download/presentation-marathi', '/api/v2/docs/download/presentation-mr'], (req, res) => {
  res.download(require('path').join(docFolder, 'Ward_Management_System_Client_Presentation_Marathi.pptx'), 'Ward_Management_System_Client_Presentation_Marathi.pptx');
});
app.get(['/download/pdf-mr', '/download/documentation-marathi', '/download/documentation-mr', '/api/v2/docs/download/pdf-mr'], (req, res) => {
  res.download(require('path').join(docFolder, 'Ward_Management_System_Complete_Documentation_Marathi.pdf'), 'Ward_Management_System_Complete_Documentation_Marathi.pdf');
});

app.use('/api', routes);
app.use('/api/v2', require('./v2/routes'));

// Serve production frontend build if dist folder exists
const path = require('path');
const fs = require('fs');
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/download')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

// Automated 2-stage data lifecycle:
// Stage 1: Active daily tasks/schedules, complaints, and chats older than 75 days are moved to the Recycle Bin.
// Stage 2: Any records in the Recycle Bin (manual deletions across all sections or 75-day auto-archived records) are permanently deleted after 30 days.
// Audit logs older than 2 days are also cleared.
try {
  const { cleanupAuditLogs, cleanupRecycleBin } = require('./v2/controllers/maintenance.controller');
  const { archiveOldSchedules } = require('./v2/controllers/schedule.controller');
  const { archiveOldComplaints } = require('./v2/controllers/complaint.controller');
  const { archiveOldChats } = require('./v2/controllers/chat.controller');

  const runMaintenance = () => Promise.all([
    cleanupAuditLogs(2),
    archiveOldChats(75),
    archiveOldComplaints(75),
    archiveOldSchedules(75),
    cleanupRecycleBin(30),
  ]).catch((err) => {
    console.error('[MAINTENANCE ERROR]', err.message);
  });

  runMaintenance();
  setInterval(runMaintenance, 24 * 60 * 60 * 1000).unref?.();
} catch (_) {}

module.exports = app;
