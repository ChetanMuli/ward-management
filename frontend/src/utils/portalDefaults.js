export const CIVIC_DEFAULT_HERO = '/hero-ward-default.jpg';
/** Same frame as Citizen Home hero (desktop overlay card). */
export const CITIZEN_HERO_ASPECT = 2.4;
export const CAMPAIGN_STOCK_RE = /hero-campaign-banner|hero-gauri-ajinkya|hero-poster-card|hero-civic-default/i;

export function wardNumberDigits(ward) {
  const raw = String(ward?.wardNumber ?? ward ?? '').replace(/\D/g, '');
  return raw.replace(/^0+/, '') || '0';
}

export function isProtectedCustomWard(ward) {
  return wardNumberDigits(ward) === '3';
}

export function isCampaignStockUrl(url) {
  return CAMPAIGN_STOCK_RE.test(String(url || ''));
}

export function isGenericDefaultHero(url) {
  const raw = String(url || '');
  return !raw || raw === CIVIC_DEFAULT_HERO || /hero-civic-default|hero-ward-default/i.test(raw);
}

/** One banner for desktop + mobile. Inactive wards use the building default. */
export function resolveCitizenHeroUrl(url, { demoMode = false } = {}) {
  if (demoMode) return CIVIC_DEFAULT_HERO;
  const live = String(Array.isArray(url) ? url[0] : url || '').trim();
  const usable = live && !live.startsWith('data:');
  return usable ? live : CIVIC_DEFAULT_HERO;
}

export function withHeroCacheBust(url, version) {
  const raw = String(url || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return raw || CIVIC_DEFAULT_HERO;
  const stamp = String(version || '').trim();
  if (!stamp) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}v=${encodeURIComponent(stamp)}`;
}

export function isNagarsevakHeroUrl(url) {
  return /hero-gauri-ajinkya|hero-campaign-banner|hero-poster-card/i.test(String(url || ''));
}

export const HIGHLIGHT_ICONS = ['🏆', '🏗️', '💧', '👥', '🛣️', '💡', '🩺', '🌱', '🏛️', '⚡', '🚰', '🧹', '🏫', '🚑', '🌳', '⭐', '📣', '📋'];

export const EMPTY_HIGHLIGHT_CARDS = [
  { id: 'h1', icon: '🏆', metric: '', metricEn: '', label: '', labelEn: '', desc: '', descEn: '' },
  { id: 'h2', icon: '🏗️', metric: '', metricEn: '', label: '', labelEn: '', desc: '', descEn: '' },
  { id: 'h3', icon: '💧', metric: '', metricEn: '', label: '', labelEn: '', desc: '', descEn: '' },
  { id: 'h4', icon: '👥', metric: '', metricEn: '', label: '', labelEn: '', desc: '', descEn: '' },
];

export function highlightHasText(card) {
  if (!card) return false;
  return [card.metric, card.metricEn, card.label, card.labelEn, card.desc, card.descEn].some((v) => String(v || '').trim());
}

function looksLikeStat(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (s.length > 12) return false;
  return /[\d०-९]/.test(s) || /[%+]/.test(s);
}

function sameText(a, b) {
  return String(a || '').replace(/\s+/g, ' ').trim().toLowerCase()
    === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** One title, optional number, optional extra line — never repeat the same words. */
export function displayHighlightCard(card, isMr = false) {
  if (!card) return { icon: '🏆', stat: '', title: '', line: '' };
  let title = String(isMr ? (card.label || card.labelEn) : (card.labelEn || card.label) || '').trim();
  let stat = String(isMr ? (card.metric || card.metricEn) : (card.metricEn || card.metric) || '').trim();
  let line = String(isMr ? (card.desc || card.descEn) : (card.descEn || card.desc) || '').trim();
  if (stat && !looksLikeStat(stat)) {
    if (!title) title = stat;
    else if (!line && !sameText(stat, title)) line = stat;
    stat = '';
  }
  if (stat && sameText(stat, title)) stat = '';
  if (line && (sameText(line, title) || sameText(line, stat))) line = '';
  return { icon: card.icon || '🏆', stat, title, line };
}

export function normalizeHighlightCard(a, idx = 0) {
  if (!a) return null;
  if (typeof a === 'string') {
    const parts = a.split('|').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return null;
    const first = parts[0];
    const asStat = looksLikeStat(first);
    return {
      id: `ach-${idx + 1}`,
      icon: '🏆',
      metric: asStat ? first : '',
      metricEn: asStat ? first : '',
      label: asStat ? (parts[1] || '') : first,
      labelEn: asStat ? (parts[1] || '') : first,
      desc: asStat ? (parts[2] || '') : (parts[1] || ''),
      descEn: asStat ? (parts[2] || '') : (parts[1] || ''),
    };
  }
  const view = displayHighlightCard({
    icon: a.icon,
    metric: String(a.metric || a.metricMr || '').trim(),
    metricEn: String(a.metricEn || a.metric || '').trim(),
    label: String(a.label || a.labelMr || a.title || '').trim(),
    labelEn: String(a.labelEn || a.titleEn || a.label || '').trim(),
    desc: String(a.desc || a.descMr || '').trim(),
    descEn: String(a.descEn || a.desc || '').trim(),
  }, false);
  const mrView = displayHighlightCard({
    icon: a.icon,
    metric: String(a.metric || a.metricMr || '').trim(),
    metricEn: String(a.metricEn || '').trim(),
    label: String(a.label || a.labelMr || a.title || '').trim(),
    labelEn: String(a.labelEn || a.titleEn || '').trim(),
    desc: String(a.desc || a.descMr || '').trim(),
    descEn: String(a.descEn || '').trim(),
  }, true);
  const icon = String(a.icon || '🏆').trim().slice(0, 8) || '🏆';
  const metric = mrView.stat || view.stat;
  const label = mrView.title || view.title;
  const desc = mrView.line || view.line;
  if (![metric, label, desc].some(Boolean)) {
    return { id: a.id || `ach-${idx + 1}`, icon, metric: '', metricEn: '', label: '', labelEn: '', desc: '', descEn: '' };
  }
  return {
    id: a.id || `ach-${idx + 1}`,
    icon,
    metric,
    metricEn: view.stat || metric,
    label,
    labelEn: view.title || label,
    desc,
    descEn: view.line || desc,
  };
}

export function normalizeHighlightCards(list, { keepEmpty = false } = {}) {
  const rows = Array.isArray(list) ? list.map((item, idx) => normalizeHighlightCard(item, idx)).filter(Boolean) : [];
  const filled = keepEmpty ? rows : rows.filter(highlightHasText);
  return filled.slice(0, 8);
}

