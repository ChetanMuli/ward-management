const fs = require('fs');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');
const { GovernmentVoterList, User, Ward } = require('../../models');
const sequelize = require('../../config/database');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const { logAudit } = require('../../services/audit.service');

const STORAGE_DIR = path.resolve(__dirname, '../../../storage/government-voter-lists');
const MAX_ROWS = 50000;

function ensureStorage() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch (_) {
    return String(value).split(',').map(x => x.trim()).filter(Boolean);
  }
}

async function assertListAccess(row, req) {
  if (req.user.roleName === 'SUPER_ADMIN') return true;
  const wardIds = parseJsonArray(row.wardIds);
  if (req.user.roleName === 'SUB_MASTER_ADMIN') {
    const allowed = (req.user.wardIds || []).map(String);
    if (!allowed.length || !wardIds.some(id => allowed.includes(String(id)))) {
      throw new ApiError(403, 'This voter list is outside your assigned wards.');
    }
    return true;
  }
  if (req.user.roleName === 'NAGARSEVAK') {
    const ownWardId = String(req.user.wardId || '');
    if (!ownWardId || !wardIds.includes(ownWardId)) {
      throw new ApiError(403, 'This voter list is outside your ward.');
    }
    return true;
  }
  throw new ApiError(403, 'You do not have access to this government voter list.');
}

function fileTypeFrom(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.pdf') return 'PDF';
  if (ext === '.xlsx') return 'XLSX';
  if (ext === '.csv') return 'CSV';
  throw new ApiError(400, 'Only PDF, XLSX or CSV voter-list files are supported.');
}

function cleanCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return JSON.stringify(v);
  }
  return String(v).trim();
}

async function extractXlsx(filePath, isCsv) {
  const workbook = new ExcelJS.Workbook();
  if (isCsv) {
    await workbook.csv.readFile(filePath, { parserOptions: { delimiter: ',' } });
  } else {
    await workbook.xlsx.readFile(filePath);
  }
  const rows = [];
  workbook.worksheets.forEach(ws => {
    if (rows.length >= MAX_ROWS) return;
    const headers = [];
    const headerRow = ws.getRow(1);
    for (let c = 1; c <= ws.columnCount; c += 1) headers.push(cleanCell(headerRow.getCell(c).value) || `Column ${c}`);
    for (let r = 2; r <= ws.rowCount && rows.length < MAX_ROWS; r += 1) {
      const row = ws.getRow(r);
      const obj = {};
      let hasValue = false;
      for (let c = 1; c <= ws.columnCount; c += 1) {
        const value = cleanCell(row.getCell(c).value);
        if (value) hasValue = true;
        obj[headers[c - 1]] = value;
      }
      if (hasValue) rows.push({ sheet: ws.name, ...obj });
    }
  });
  return rows;
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stderr }));
      else resolve(stdout);
    });
  });
}

function parseOcrPage(text, pageNumber) {
  const cleaned = String(text || '').replace(/\r/g, '');
  const serials = [...cleaned.matchAll(/^\s*(\d{1,3})\s*$/gm)].map(m => Number(m[1])).filter(n => n > 0 && n <= MAX_ROWS);
  const epics = [...cleaned.matchAll(/\b[A-Z]{2,3}\/?\d{6,10}\b/g)].map(m => m[0]);
  const chunks = cleaned.split(/\n(?=Name\s*:)/).slice(1);
  const entries = [];
  for (const chunk of chunks) {
    const name = ((chunk.match(/^Name\s*:\s*(.+)$/m) || [])[1] || '').replace(/[|¦]/g,'I').replace(/\s+/g,' ').trim();
    const ageGender = chunk.match(/Age\s*:\s*(\d+)\s+Gender\s*:\s*(Male|Female|Third Gender)/i);
    if (!name || !ageGender) continue;
    const relative = chunk.match(/(?:Father's|Husband's|Mother's)\s+Name\s*:\s*(.+)$/m);
    const relativeType = chunk.match(/(Father's|Husband's|Mother's)\s+Name\s*:/i);
    const houseMatch = chunk.match(/House Number\s*:\s*(.*?)(?=\n(?:Photo|Age\s*:)|$)/s);
    let house = (houseMatch?.[1] || '').replace(/\s+/g, ' ').trim();
    if (/^Age\s*:/i.test(house)) house = '';
    entries.push({
      name,
      relativeName: (relative?.[1] || '').replace(/[|¦]/g,'I').replace(/\s+/g,' ').trim(),
      relativeType: relativeType?.[1] || '',
      houseNumber: house.replace(/[|¦]/g,'I'),
      age: Number(ageGender[1]),
      gender: ageGender[2],
    });
  }

  // OCR places the serial/EPIC header above the corresponding three-column cards.
  // Recover the first serial on the page and pair sequentially with the extracted cards.
  const firstSerial = [...cleaned.matchAll(/(?:^|\n)\s*(\d{1,3})\s+(?=[A-Z]{2,3}\/?\d{6,10})/g)]
    .map(m => Number(m[1])).find(n => n > 0 && n <= MAX_ROWS);
  const start = firstSerial || serials[0] || null;
  return entries.map((entry, index) => ({
    page: pageNumber,
    serialNo: start ? start + index : index + 1,
    epicNo: epics[index] || '',
    ...entry,
  }));
}

async function extractPdfOcr(filePath) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ward-voter-'));
  try {
    // Render one page at a time at 150 DPI. Election Commission rolls are commonly
    // scanned/image based; higher DPI materially improves names/EPIC OCR accuracy. Nginx is configured with a longer API timeout.
    const info = await execFileAsync('pdfinfo', [filePath], { timeout: 30000 });
    const pageMatch = String(info).match(/^Pages:\s+(\d+)/m);
    const pageCount = Math.min(Number(pageMatch?.[1]) || 1, 500);
    const rows = [];
    for (let pageNumber = 1; pageNumber <= pageCount && rows.length < MAX_ROWS; pageNumber += 1) {
      const base = path.join(tempDir, `page-${pageNumber}`);
      await execFileAsync('pdftoppm', ['-f', String(pageNumber), '-l', String(pageNumber), '-r', '150', '-jpeg', '-singlefile', filePath, base], { timeout: 30000 });
      const imagePath = `${base}.jpg`;
      const text = await execFileAsync('tesseract', [imagePath, 'stdout', '--psm', '3', '--oem', '1'], { timeout: 120000 });
      rows.push(...parseOcrPage(text, pageNumber));
      try { await fs.promises.unlink(imagePath); } catch (_) {}
    }
    return rows.slice(0, MAX_ROWS);
  } catch (err) {
    const missing = /ENOENT/.test(err.code || '') || /not found/i.test(err.message || '');
    if (missing) throw new ApiError(500, 'PDF OCR is not available on the server. Install pdfinfo, pdftoppm and tesseract-ocr, then try again.');
    throw err;
  } finally {
    fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
async function extractPdf(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const parsed = await pdfParse(buffer);
  const text = String(parsed.text || '');
  const voterRecordSignals = (text.match(/\bName\s*:/g)||[]).length + (text.match(/\bAge\s*:\s*\d+/g)||[]).length;
  // Do not treat PDF metadata / page headers as voter records. If the document
  // looks like an image-based electoral roll, always use page OCR so the result
  // is a real table of voter fields rather than arbitrary PDF text lines.
  if (voterRecordSignals >= 5) {
    const chunks = text.split(/\n(?=Name\s*:)/).slice(1);
    const rows = chunks.map((chunk,index) => {
      const name=((chunk.match(/^Name\s*:\s*(.+)$/m)||[])[1]||'').replace(/[|¦]/g,'I').replace(/\s+/g,' ').trim();
      const ageGender=chunk.match(/Age\s*:\s*(\d+)\s+Gender\s*:\s*(Male|Female|Third Gender)/i);
      const relative=chunk.match(/(?:Father's|Husband's|Mother's)\s+Name\s*:\s*(.+)$/m);
      return {name,relativeName:(relative?.[1]||'').trim(),age:ageGender?Number(ageGender[1]):null,gender:ageGender?.[2]||'',line:index+1,text:chunk.trim()};
    }).filter(r=>r.name);
    if (rows.length >= 5) return rows.slice(0,MAX_ROWS);
  }
  return extractPdfOcr(filePath);
}

async function extractFile(filePath, fileType) {
  if (fileType === 'PDF') return extractPdf(filePath);
  return extractXlsx(filePath, fileType === 'CSV');
}

const list = asyncHandler(async (req, res) => {
  const rows = await GovernmentVoterList.findAll({
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
    order: [[sequelize.literal('`GovernmentVoterList`.`created_at`'), 'DESC']],
    attributes: { exclude: ['extractedData'] },
  });
  const visible = [];
  for (const row of rows) {
    try { await assertListAccess(row, req); visible.push(row); } catch (_) {}
  }
  return success(res, { data: visible.map(row => ({
    ...row.toJSON(),
    wardIds: parseJsonArray(row.wardIds),
    assignedNagarsevakIds: parseJsonArray(row.assignedNagarsevakIds),
  })) });
});

const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Please select a PDF, XLSX or CSV voter list file.');
  ensureStorage();

  const fileType = fileTypeFrom(req.file);
  let wardIds = parseJsonArray(req.body.wardIds);
  let assignmentMode = String(req.body.assignmentMode || 'UPLOADER_ONLY').toUpperCase();
  let assignedNagarsevakIds = parseJsonArray(req.body.assignedNagarsevakIds);

  if (req.user.roleName === 'NAGARSEVAK') {
    if (!req.user.wardId) throw new ApiError(403, 'Your Nagarsevak account is not assigned to a ward.');
    wardIds = [String(req.user.wardId)];
    assignmentMode = 'ALL_NAGARSEVAKS';
    assignedNagarsevakIds = [];
  } else if (req.user.roleName === 'SUPER_ADMIN' || req.user.roleName === 'SUB_MASTER_ADMIN') {
    if (wardIds.length !== 1) throw new ApiError(400, 'Select one ward for this government voter list.');
    if (req.user.roleName === 'SUB_MASTER_ADMIN') {
      const allowed = (req.user.wardIds || []).map(String);
      if (!allowed.includes(String(wardIds[0]))) throw new ApiError(403, 'You can only upload a voter list for an assigned ward.');
    }
    const wardRows = await Ward.findAll({ where: { id: wardIds, status: 'ACTIVE' }, attributes: ['id'] });
    if (wardRows.length !== 1) throw new ApiError(400, 'The selected ward is invalid.');
    assignmentMode = 'ALL_NAGARSEVAKS';
    assignedNagarsevakIds = [];
  } else {
    throw new ApiError(403, 'Only Master Admin, Sub Master Admin or Nagarsevak can upload government voter lists.');
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const safeBase = path.basename(req.file.originalname || 'voter-list').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const storedFileName = `${Date.now()}-${safeBase}-${Math.random().toString(36).slice(2,10)}${ext}`;
  const finalPath = path.join(STORAGE_DIR, storedFileName);

  try {
    await fs.promises.writeFile(finalPath, req.file.buffer);
    const extractedData = await extractFile(finalPath, fileType);
    const row = await GovernmentVoterList.create({
      originalFileName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      fileType,
      fileSize: req.file.size || 0,
      extractedCount: extractedData.length,
      extractedData,
      uploadedBy: req.user.id,
      wardIds,
      assignmentMode,
      assignedNagarsevakIds,
    });
    await logAudit({
      user: req.user, action: 'UPLOAD_GOVERNMENT_VOTER_LIST', entity: 'GovernmentVoterList',
      recordId: row.id, newValue: { fileName: row.originalFileName, fileType, extractedCount: row.extractedCount },
      ipAddress: req.ip,
    });
    return success(res, {
      statusCode: 201,
      message: `Voter list uploaded and ${extractedData.length} records extracted.`,
      data: {
        id: row.id, originalFileName: row.originalFileName, fileType: row.fileType,
        fileSize: row.fileSize, extractedCount: row.extractedCount, createdAt: row.createdAt,
      },
    });
  } catch (err) {
    try { await fs.promises.unlink(finalPath); } catch (_) {}
    if (err instanceof ApiError) throw err;
    if (err?.code === 'ETIMEDOUT') throw new ApiError(504, `Government voter-list extraction timed out. Please try Extract again; the original file is kept safely.`);
    throw new ApiError(400, `Could not extract this ${fileType} file. Please verify the file is valid.`);
  }
});

const extract = asyncHandler(async (req, res) => {
  const row = await GovernmentVoterList.findByPk(req.params.id);
  if (!row) throw new ApiError(404, 'Voter list not found');
  await assertListAccess(row, req);
  ensureStorage();
  const filePath = path.join(STORAGE_DIR, row.storedFileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'Original voter list file is missing from server storage.');
  const extractedData = await extractFile(filePath, row.fileType);
  await row.update({ extractedData, extractedCount: extractedData.length });
  return success(res, { data: { id: row.id, extractedCount: row.extractedCount }, message: `Extracted ${row.extractedCount} records successfully.` });
});

const download = asyncHandler(async (req, res) => {
  const row = await GovernmentVoterList.findByPk(req.params.id);
  if (!row) throw new ApiError(404, 'Voter list not found');
  await assertListAccess(row, req);
  const filePath = path.join(STORAGE_DIR, row.storedFileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, 'Original voter list file is missing from server storage.');
  res.setHeader('Content-Type', row.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${String(row.originalFileName).replace(/"/g, '')}"`);
  return res.sendFile(filePath);
});


const remove = asyncHandler(async (req, res) => {
  const row = await GovernmentVoterList.findByPk(req.params.id);
  if (!row) throw new ApiError(404, 'Voter list not found');
  await assertListAccess(row, req);
  // Keep the original file while it is in Recycle Bin so it can be restored.
  // Missing files must not block delete — extracted rows stay in the database until recycle cleanup.
  await row.destroy();
  await logAudit({
    user: req.user,
    action: 'DELETE_GOVERNMENT_VOTER_LIST',
    entity: 'GovernmentVoterList',
    recordId: row.id,
    oldValue: { fileName: row.originalFileName, extractedCount: row.extractedCount },
    ipAddress: req.ip,
  });
  return success(res, { message: 'Government voter list moved to Recycle Bin.' });
});

const details = asyncHandler(async (req, res) => {
  const row = await GovernmentVoterList.findByPk(req.params.id, {
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name', 'email'] }],
  });
  if (!row) throw new ApiError(404, 'Voter list not found');
  await assertListAccess(row, req);
  const json=row.toJSON();
  return success(res, { data: {
    ...json,
    wardIds: parseJsonArray(row.wardIds),
    assignedNagarsevakIds: parseJsonArray(row.assignedNagarsevakIds),
  } });
});

module.exports = { list, upload, extract, download, details, remove };
