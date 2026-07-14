import crypto from 'node:crypto';

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
export function normalize(value) {
  return clean(value).normalize('NFKC').toLowerCase()
    .replace(/[【】\[\]()（）「」『』]/g, ' ')
    .replace(/[・･·]/g, ' ')
    .replace(/[／/|｜]/g, ' ')
    .replace(/[!?！？,，.。:：;'"“”‘’~〜～_-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
export function videoIdFromUrl(url='') {
  const s=String(url);
  return s.match(/[?&]v=([\w-]{11})/)?.[1] || s.match(/youtu\.be\/([\w-]{11})/)?.[1] || s.match(/shorts\/([\w-]{11})/)?.[1] || '';
}
export function isoDurationToSeconds(v='') {
  const m=String(v).match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0) : 0;
}
export function parseDate(text='') {
  const m=String(text).match(/(20\d{2})[./年-](\d{1,2})[./月-](\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}
export function songId(song, singers, type) {
  return crypto.createHash('sha1').update(`${normalize(song)}|${[...singers].sort().join('|')}|${type}`).digest('hex').slice(0,16);
}
export function csvSafe(v){ return v == null ? '' : v instanceof Date ? v.toISOString() : String(v); }
