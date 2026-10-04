/** Display W-03 / W03 as "Ward 03" (or Marathi वॉर्ड 03). Storage stays W-03. */

export function wardDigits(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const stripped = raw
    .replace(/^वॉर्ड\s*(क्र\.?)?\s*/i, '')
    .replace(/^प्रभाग\s*/i, '')
    .replace(/^ward\s*(no\.?|number|#)?\s*/i, '')
    .replace(/^w[\s.\-]*/i, '');
  const m = stripped.match(/(\d{1,3})/);
  return m ? String(m[1]).padStart(2, '0') : '';
}

export function formatWardNumber(value, langOverride) {
  if (value == null || value === '') return '';
  const digits = wardDigits(value);
  if (!digits) return String(value).replace(/^W-/i, 'Ward ');
  let lang = langOverride || 'en';
  if (!langOverride) {
    try {
      lang = String(localStorage.getItem('ward_language') || 'en');
    } catch (_) {}
  }
  return lang === 'mr' ? `वॉर्ड ${digits}` : `Ward ${digits}`;
}

export function formatWardLabel(ward, empty = '—') {
  if (!ward) return empty;
  const no = formatWardNumber(ward.wardNumber || ward.ward_number);
  if (!no) return ward.name || empty;
  return ward.name ? `${no} · ${ward.name}` : no;
}
