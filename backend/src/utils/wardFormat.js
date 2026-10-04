'use strict';

function wardDigits(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const stripped = raw
    .replace(/^ward\s*(no\.?|number|#)?\s*/i, '')
    .replace(/^w[\s.\-]*/i, '');
  const m = stripped.match(/(\d{1,3})/);
  return m ? String(m[1]).padStart(2, '0') : '';
}

function formatWardNumber(value) {
  if (value == null || value === '') return '';
  const digits = wardDigits(value);
  if (!digits) return String(value).replace(/^W-/i, 'Ward ');
  return `Ward ${digits}`;
}

function formatWardLabel(ward, empty = '') {
  if (!ward) return empty;
  const no = formatWardNumber(ward.wardNumber || ward.ward_number);
  if (!no) return ward.name || empty;
  return ward.name ? `${no} · ${ward.name}` : no;
}

module.exports = { wardDigits, formatWardNumber, formatWardLabel };
