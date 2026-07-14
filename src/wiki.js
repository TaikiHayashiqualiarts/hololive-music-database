import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { clean, normalize, parseDate, unique, videoIdFromUrl } from './util.js';
import { TALENT_LIST } from './talents.js';

const DATE_PATTERN = /20\d{2}\s*[./年-]\s*\d{1,2}\s*[./月-]\s*\d{1,2}/;
const YOUTUBE_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}[^\s<]*/gi;

function aliasesFor(talent) {
  return unique([talent.kanji, talent.eng, ...talent.aliases])
    .map(value => normalize(value))
    .filter(value => value.length >= 2);
}

const TALENT_ALIASES = TALENT_LIST.map(talent => ({
  name: talent.kanji,
  aliases: aliasesFor(talent),
}));

function detectTalents(text) {
  const normalized = normalize(text);
  return TALENT_ALIASES
    .filter(talent => talent.aliases.some(alias => normalized.includes(alias)))
    .map(talent => talent.name);
}

function linksFromElement($, element) {
  return $(element)
    .find('a[href]')
    .map((_, anchor) => $(anchor).attr('href'))
    .get()
    .filter(Boolean);
}

function chooseSong(cells, memberText, dateText) {
  const ignored = /^(編集|詳細|備考|動画|リンク|link|日付|投稿日|公開日|メンバー|歌唱者|曲名|楽曲名)$/i;
  const candidates = cells
    .map(clean)
    .filter(Boolean)
    .filter(value => value !== memberText && value !== dateText)
    .filter(value => !parseDate(value))
    .filter(value => !ignored.test(value))
    .filter(value => !/^(https?:\/\/|youtu\.be)/i.test(value));

  return candidates
    .sort((a, b) => {
      const aScore = detectTalents(a).length ? -100 : a.length;
      const bScore = detectTalents(b).length ? -100 : b.length;
      return bScore - aScore;
    })[0] || '';
}

function rowObject({ type, sourceUrl, text, cells = [], links = [] }) {
  const date = parseDate(text) || cells.map(parseDate).find(Boolean) || '';
  const singers = detectTalents(text);
  const memberCell = cells.find(cell => detectTalents(cell).length > 0) || '';
  const dateCell = cells.find(cell => Boolean(parseDate(cell))) || '';
  const youtubeUrl = links.find(link => /youtu\.be|youtube\.com/i.test(link))
    || text.match(YOUTUBE_PATTERN)?.[0]
    || '';
  const videoId = videoIdFromUrl(youtubeUrl);
  const song = chooseSong(cells, memberCell, dateCell);

  if (!song) return null;
  if (!date && !videoId && singers.length === 0) return null;
  if (/^(日付|投稿日|公開日|メンバー|歌唱者|曲名|楽曲名|備考)$/i.test(song)) return null;

  return {
    type,
    date,
    membersRaw: memberCell,
    singers,
    song,
    notes: '',
    videoId,
    videoUrl: youtubeUrl,
    sourceUrl,
  };
}

function parseTables($, type, sourceUrl) {
  const rows = [];
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('th,td').map((__, cell) => clean($(cell).text())).get();
    if (cells.length < 2) return;
    const text = cells.join(' | ');
    const parsed = rowObject({ type, sourceUrl, text, cells, links: linksFromElement($, tr) });
    if (parsed) rows.push(parsed);
  });
  return rows;
}

function parseStructuredBlocks($, type, sourceUrl) {
  const rows = [];
  const selectors = [
    '.wiki-content li', '.user-area li', '.article-body li',
    '.wiki-content p', '.user-area p', '.article-body p',
    '.wiki-content > div', '.user-area > div', '.article-body > div',
  ];

  $(selectors.join(',')).each((_, element) => {
    const text = clean($(element).text());
    if (!DATE_PATTERN.test(text) && !/youtu\.be|youtube\.com/i.test($(element).html() || '')) return;
    const cells = text.split(/\s{2,}|\||\t/).map(clean).filter(Boolean);
    const parsed = rowObject({ type, sourceUrl, text, cells, links: linksFromElement($, element) });
    if (parsed) rows.push(parsed);
  });
  return rows;
}

function parseTextLines(bodyText, type, sourceUrl) {
  const lines = String(bodyText)
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
  const rows = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!DATE_PATTERN.test(lines[i])) continue;
    const block = lines.slice(i, Math.min(lines.length, i + 7));
    const text = block.join(' | ');
    const parsed = rowObject({ type, sourceUrl, text, cells: block, links: text.match(YOUTUBE_PATTERN) || [] });
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function dedupeRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = [normalize(row.song), [...row.singers].sort().join('|'), row.type, row.videoId || row.date].join('|');
    const existing = map.get(key);
    if (!existing || (!existing.videoId && row.videoId)) map.set(key, row);
  }
  return [...map.values()];
}

async function saveDiagnostics(page, type, html, bodyText) {
  await fs.mkdir('output/diagnostics', { recursive: true });
  const safeType = type === 'カバー' ? 'cover' : 'original';
  await Promise.all([
    fs.writeFile(`output/diagnostics/wiki-${safeType}.html`, html),
    fs.writeFile(`output/diagnostics/wiki-${safeType}.txt`, bodyText),
    page.screenshot({ path: `output/diagnostics/wiki-${safeType}.png`, fullPage: true }),
  ]);
}

async function openWikiPage(page, source) {
  const response = await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  const status = response?.status() || 0;
  const title = await page.title();
  const html = await page.content();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  return { status, title, html, bodyText, finalUrl: page.url() };
}

export async function fetchWiki(settings, log = console.log) {
  await fs.mkdir('output', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    extraHTTPHeaders: {
      'accept-language': 'ja,en-US;q=0.8,en;q=0.6',
      referer: settings.wiki.home,
    },
  });
  const page = await context.newPage();
  const allRows = [];

  try {
    for (const source of settings.wiki.sources) {
      log(`Wiki取得開始: ${source.type}`);
      const result = await openWikiPage(page, source);
      log(`Wiki応答: ${source.type} status=${result.status} title=${result.title} chars=${result.bodyText.length}`);

      const $ = cheerio.load(result.html);
      const parsed = dedupeRows([
        ...parseTables($, source.type, result.finalUrl),
        ...parseStructuredBlocks($, source.type, result.finalUrl),
        ...parseTextLines(result.bodyText, source.type, result.finalUrl),
      ]);

      await saveDiagnostics(page, source.type, result.html, result.bodyText);

      if (parsed.length === 0) {
        throw new Error(`${source.type}を解析できませんでした。status=${result.status}, 本文=${result.bodyText.length}文字。output/diagnostics を確認してください。`);
      }

      log(`Wiki抽出完了: ${source.type} ${parsed.length}件`);
      allRows.push(...parsed);
    }
  } finally {
    await browser.close();
  }

  const rows = dedupeRows(allRows);
  await fs.writeFile('output/wiki_raw.json', JSON.stringify(rows, null, 2));
  return rows;
}
