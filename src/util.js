import crypto from 'node:crypto';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const clean = value => String(value ?? '').replace(/[\u00a0\u3000]/g, ' ').replace(/\s+/g, ' ').trim();

export function normalize(value) {
  return clean(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[【】\[\]()（）「」『』〈〉《》]/g, ' ')
    .replace(/[・･·]/g, ' ')
    .replace(/[／/|｜]/g, ' ')
    .replace(/[!?！？,，.。:：;；'"“”‘’~〜～_–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function videoIdFromUrl(url = '') {
  const text = String(url);
  return text.match(/[?&]v=([\w-]{11})/)?.[1]
    || text.match(/youtu\.be\/([\w-]{11})/)?.[1]
    || text.match(/shorts\/([\w-]{11})/)?.[1]
    || text.match(/embed\/([\w-]{11})/)?.[1]
    || '';
}

export function isoDurationToSeconds(value = '') {
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return match
    ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)
    : 0;
}

export function parseDate(text = '') {
  const value = String(text).normalize('NFKC');
  const match = value.match(/(20\d{2})\s*[./年-]\s*(\d{1,2})\s*[./月-]\s*(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

export function songId(song, singers, type) {
  return crypto
    .createHash('sha1')
    .update(`${normalize(song)}|${[...singers].sort().join('|')}|${type}`)
    .digest('hex')
    .slice(0, 16);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
