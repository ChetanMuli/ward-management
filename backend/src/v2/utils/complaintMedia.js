function parseImageList(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim());
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim()) : [];
    } catch (_) {
      return [];
    }
  }
  return [text];
}

function packImageList(value, cleanOne) {
  const list = parseImageList(value).slice(0, 8).map((item) => (cleanOne ? cleanOne(item) : item)).filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  return JSON.stringify(list);
}

module.exports = { parseImageList, packImageList };
