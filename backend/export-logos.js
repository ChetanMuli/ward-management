const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// Target output directories
const dirs = [
  path.join(__dirname, '..', 'logos'),
  path.join(__dirname, '..', 'frontend', 'public', 'logos'),
  'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c8fa2c47-1d4c-40fa-b0bb-758f1dd580c2'
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

function renderSvg(svgString, width, filename) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: width }
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  dirs.forEach(dir => {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, pngBuffer);
  });
  console.log(`Exported ${filename} (${width}px) to all target directories.`);
}

// 1. Transparent Emblem (Navy Blue + Gold + Cyan/White) - Tight viewBox so it fills canvas!
const svgTransparent = `<svg viewBox="16 6 68 89" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8C33.4 8 20 21.4 20 38C20 60 50 92 50 92C50 92 80 60 80 38C80 21.4 66.6 8 50 8Z" fill="#1e3a5f"/>
  <polygon points="50,18 61,27 39,27" fill="#f59e0b"/>
  <path d="M33 34L43 62L50 44L57 62L67 34" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M43 62L50 44L57 62" stroke="#38bdf8" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="91" r="2.5" fill="#f59e0b"/>
</svg>`;

// 2. Transparent Emblem Royal Blue (Vibrant) - Tight viewBox
const svgRoyalTransparent = `<svg viewBox="16 6 68 89" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M50 8C33.4 8 20 21.4 20 38C20 60 50 92 50 92C50 92 80 60 80 38C80 21.4 66.6 8 50 8Z" fill="#2563eb"/>
  <polygon points="50,18 61,27 39,27" fill="#fbbf24"/>
  <path d="M33 34L43 62L50 44L57 62L67 34" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M43 62L50 44L57 62" stroke="#67e8f9" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="91" r="2.5" fill="#fbbf24"/>
</svg>`;

// 3. App Icon Dark Squircle (1024x1024) - Bold & prominent
const svgDarkSquircle = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="22" fill="#0f172a"/>
  <path d="M50 7C32.4 7 18 21.4 18 39C18 63 50 93 50 93C50 93 82 63 82 39C82 21.4 67.6 7 50 7Z" fill="#2563eb"/>
  <circle cx="50" cy="39" r="23" fill="#1e3a5f" fill-opacity="0.45"/>
  <polygon points="50,17 62,27 38,27" fill="#fbbf24"/>
  <path d="M32 35L42 64L50 45L58 64L68 35" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M42 64L50 45L58 64" stroke="#67e8f9" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="92" r="2.5" fill="#fbbf24"/>
</svg>`;

// 4. App Icon White Squircle (1024x1024)
const svgWhiteSquircle = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="22" fill="#ffffff"/>
  <rect x="1.5" y="1.5" width="97" height="97" rx="20.5" stroke="#e2e8f0" stroke-width="2.5"/>
  <path d="M50 7C32.4 7 18 21.4 18 39C18 63 50 93 50 93C50 93 82 63 82 39C82 21.4 67.6 7 50 7Z" fill="#1e3a5f"/>
  <polygon points="50,17 62,27 38,27" fill="#f59e0b"/>
  <path d="M32 35L42 64L50 45L58 64L68 35" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M42 64L50 45L58 64" stroke="#38bdf8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="92" r="2.5" fill="#f59e0b"/>
</svg>`;

// 5. Horizontal Lockup Banner (Emblem + Typography) - Dark
const svgBannerDark = `<svg viewBox="0 0 520 150" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="520" height="150" rx="18" fill="#0b1320"/>
  <g transform="translate(24, 15) scale(1.3)">
    <path d="M50 8C33.4 8 20 21.4 20 38C20 60 50 92 50 92C50 92 80 60 80 38C80 21.4 66.6 8 50 8Z" fill="#2563eb"/>
    <circle cx="50" cy="38" r="26" fill="#1e3a5f" fill-opacity="0.45"/>
    <polygon points="50,18 61,27 39,27" fill="#fbbf24"/>
    <path d="M33 34L43 62L50 44L57 62L67 34" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M43 62L50 44L57 62" stroke="#67e8f9" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="50" cy="91" r="2.5" fill="#fbbf24"/>
  </g>
  <text x="156" y="74" fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="44" letter-spacing="-0.03em">WardDesk</text>
  <text x="158" y="106" fill="#38bdf8" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="700" font-size="14" letter-spacing="0.1em" text-transform="uppercase">MUNICIPAL WORKSPACE</text>
</svg>`;

// 6. Horizontal Lockup Banner (Emblem + Typography) - Light / Transparent
const svgBannerLight = `<svg viewBox="0 0 520 150" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(24, 15) scale(1.3)">
    <path d="M50 8C33.4 8 20 21.4 20 38C20 60 50 92 50 92C50 92 80 60 80 38C80 21.4 66.6 8 50 8Z" fill="#1e3a5f"/>
    <polygon points="50,18 61,27 39,27" fill="#f59e0b"/>
    <path d="M33 34L43 62L50 44L57 62L67 34" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M43 62L50 44L57 62" stroke="#38bdf8" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="50" cy="91" r="2.5" fill="#f59e0b"/>
  </g>
  <text x="156" y="74" fill="#0f172a" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="900" font-size="44" letter-spacing="-0.03em">WardDesk</text>
  <text x="158" y="106" fill="#2563eb" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-weight="700" font-size="14" letter-spacing="0.1em" text-transform="uppercase">MUNICIPAL WORKSPACE</text>
</svg>`;

// Render all files
renderSvg(svgTransparent, 512, 'warddesk-logo-512.png');
renderSvg(svgTransparent, 1024, 'warddesk-logo-1024.png');
renderSvg(svgRoyalTransparent, 1024, 'warddesk-logo-royal-1024.png');
renderSvg(svgDarkSquircle, 512, 'warddesk-app-icon-dark-512.png');
renderSvg(svgDarkSquircle, 1024, 'warddesk-app-icon-dark-1024.png');
renderSvg(svgWhiteSquircle, 512, 'warddesk-app-icon-white-512.png');
renderSvg(svgWhiteSquircle, 1024, 'warddesk-app-icon-white-1024.png');
renderSvg(svgBannerDark, 2080, 'warddesk-banner-dark.png');
renderSvg(svgBannerLight, 2080, 'warddesk-banner-light.png');

console.log('All logo PNG assets successfully re-generated with prominent scale!');
