const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '..', 'logos');
const artifactDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c8fa2c47-1d4c-40fa-b0bb-758f1dd580c2';

const files = [
  {
    id: 'transparent-1024',
    title: 'WardDesk Official Emblem (Transparent)',
    desc: 'High-res transparent PNG with municipal navy blue pin, golden civic apex, and geometric desk W. Perfect for any background, letterhead, or document.',
    filename: 'warddesk-logo-1024.png',
    size: '1024 × 1024 px',
    bg: 'transparent'
  },
  {
    id: 'app-icon-dark-1024',
    title: 'App Store & Android Icon (Dark Navy Tile)',
    desc: 'Full rounded squircle app icon on municipal midnight navy (#0f172a). Official design for Google Play, Apple App Store, and Android APK launcher.',
    filename: 'warddesk-app-icon-dark-1024.png',
    size: '1024 × 1024 px',
    bg: 'dark'
  },
  {
    id: 'app-icon-white-1024',
    title: 'App Icon (Clean White Tile)',
    desc: 'Light-themed squircle badge with subtle architectural border. Best for white presentations, website navigation, and light branding.',
    filename: 'warddesk-app-icon-white-1024.png',
    size: '1024 × 1024 px',
    bg: 'light'
  },
  {
    id: 'banner-dark',
    title: 'Brand Header Banner (Dark)',
    desc: 'Wide lockup with the official emblem, bold typography, and civic subtitle on dark slate background.',
    filename: 'warddesk-banner-dark.png',
    size: '1920 × 560 px',
    bg: 'dark'
  },
  {
    id: 'banner-light',
    title: 'Brand Header Banner (Transparent / Light)',
    desc: 'Wide lockup with official emblem and bold typography on transparent background for documents, presentations, and light themes.',
    filename: 'warddesk-banner-light.png',
    size: '1920 × 560 px',
    bg: 'light'
  },
  {
    id: 'royal-transparent-1024',
    title: 'Vibrant Royal Blue Emblem (Transparent)',
    desc: 'High-contrast royal blue variation (#2563eb) with gold apex and cyan accents.',
    filename: 'warddesk-logo-royal-1024.png',
    size: '1024 × 1024 px',
    bg: 'transparent'
  }
];

let cardsHtml = '';

files.forEach(f => {
  const filePath = path.join(logosDir, f.filename);
  const base64Data = fs.readFileSync(filePath).toString('base64');
  const dataUri = `data:image/png;base64,${base64Data}`;

  let previewBgClass = 'bg-slate-100 checkerboard';
  if (f.bg === 'dark') previewBgClass = 'bg-[#0b1320]';
  if (f.bg === 'light') previewBgClass = 'bg-slate-50 border border-slate-200';

  cardsHtml += `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
      <div class="p-6 ${previewBgClass} flex items-center justify-center min-h-[220px]">
        <img src="${dataUri}" alt="${f.title}" class="max-h-40 max-w-full object-contain drop-shadow-sm" />
      </div>
      <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <h3 class="text-base font-bold text-slate-900">${f.title}</h3>
            <span class="text-[11px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200">${f.size}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${f.desc}</p>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
          <span class="text-[11px] font-mono text-slate-400 truncate">${f.filename}</span>
          <a href="${dataUri}" download="${f.filename}" class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PNG
          </a>
        </div>
      </div>
    </div>
  `;
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WardDesk - Logo PNG Downloads</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .checkerboard {
      background-image: linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 p-6 md:p-12">
  <div class="max-w-5xl mx-auto space-y-8">

    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
      <div class="space-y-1">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">
          <span>Official Brand Package</span>
        </div>
        <h1 class="text-3xl font-black text-slate-900 tracking-tight">WardDesk Logo PNG Downloads</h1>
        <p class="text-sm text-slate-600">High-resolution raster PNG images ready for use in mobile apps, websites, presentations, and documents.</p>
      </div>

      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-xs space-y-1">
        <span class="font-bold text-slate-800 block">📁 Local Folder on Your PC:</span>
        <code class="text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-mono text-[11px] block select-all">c:\\Users\\DELL\\Downloads\\ward-management-system-v1\\logos</code>
      </div>
    </div>

    <!-- Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cardsHtml}
    </div>

    <!-- Usage Guidelines Footer -->
    <div class="bg-slate-900 text-white rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="space-y-2">
        <h3 class="text-lg font-bold">Files Are Also Saved Directly in Your Project</h3>
        <p class="text-xs text-slate-300 max-w-xl leading-relaxed">
          You can also grab the files directly from the <code class="text-cyan-300">/logos</code> directory in your workspace folder, or from <code class="text-cyan-300">/frontend/public/logos</code> which are served statically by your frontend server.
        </p>
      </div>
    </div>

  </div>
</body>
</html>`;

const outPath = path.join(artifactDir, 'download_logos.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Saved interactive download artifact to:', outPath);
