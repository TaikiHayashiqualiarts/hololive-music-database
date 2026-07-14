import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { clean, normalize, parseDate, videoIdFromUrl } from './util.js';
import { TALENT_LIST } from './talents.js';

function talentNames(text) {
  const n=normalize(text); const found=[];
  for (const t of TALENT_LIST) {
    const names=[t.kanji,t.eng,...t.aliases].map(normalize).filter(x=>x.length>=2);
    if (names.some(x=>n.includes(x))) found.push(t.kanji);
  }
  return [...new Set(found)];
}
function headerIndex(headers, words){ return headers.findIndex(h=>words.some(w=>normalize(h).includes(normalize(w)))); }
function parseTable($, table, type, sourceUrl) {
  const rows=[]; const trs=$(table).find('tr').toArray(); if(!trs.length) return rows;
  let headers=$(trs[0]).find('th,td').map((_,e)=>clean($(e).text())).get();
  const looksHeader=headers.some(h=>/日付|メンバー|曲名|備考|歌唱/.test(h));
  const start=looksHeader?1:0;
  const dateI=headerIndex(headers,['日付','公開日','投稿日']);
  const memberI=headerIndex(headers,['メンバー','歌唱','歌手','アーティスト']);
  const songI=headerIndex(headers,['曲名','楽曲名','タイトル']);
  const noteI=headerIndex(headers,['備考','注記']);
  for(let i=start;i<trs.length;i++){
    const cells=$(trs[i]).find('th,td').toArray(); if(cells.length<2) continue;
    const texts=cells.map(e=>clean($(e).text()));
    const links=cells.flatMap(e=>$(e).find('a[href]').map((_,a)=>$(a).attr('href')).get()).filter(Boolean);
    const date=(dateI>=0?parseDate(texts[dateI]):texts.map(parseDate).find(Boolean))||'';
    const members=memberI>=0?texts[memberI]:texts.find(x=>talentNames(x).length)||'';
    let song=songI>=0?texts[songI]:'';
    if(!song){
      const candidates=texts.filter(x=>x && !parseDate(x) && x!==members && !/編集|備考|動画|link/i.test(x));
      song=candidates.sort((a,b)=>b.length-a.length)[0]||'';
    }
    const singers=talentNames(members+' '+texts.join(' '));
    const youtube=links.find(x=>/youtu\.be|youtube\.com/.test(x))||'';
    const videoId=videoIdFromUrl(youtube);
    if(!song || (!date && !videoId && !singers.length)) continue;
    if(/日付|メンバー|曲名|備考/.test(song) && song.length<20) continue;
    rows.push({type,date,membersRaw:members,singers,song,notes:noteI>=0?texts[noteI]:'',videoId,videoUrl:youtube,sourceUrl});
  }
  return rows;
}
async function discover(page, home, keywords, fallback){
  await page.goto(home,{waitUntil:'domcontentloaded',timeout:90000});
  const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>({text:(a.textContent||'').replace(/\s+/g,' ').trim(),href:a.href})));
  const hit=links.find(x=>keywords.every(k=>x.text.includes(k)));
  return hit?.href||fallback;
}
export async function fetchWiki(settings, log=console.log){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'ja-JP',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'});
  const page=await context.newPage();
  const fallbackCover='https://seesaawiki.jp/hololivetv/d/%a5%db%a5%ed%a5%e9%a5%a4%a5%d6%a1%da%b2%ce%a4%c3%a4%c6%a4%df%a4%bf%c6%b0%b2%e8%b0%ec%cd%f7%a1%db_%b4%ca%b0%d7%c8%c7';
  const fallbackOriginal='https://seesaawiki.jp/hololivetv/d/%a5%aa%a5%ea%a5%b8%a5%ca%a5%eb%a5%bd%a5%f3%a5%b0_%c1%e1%b8%ab%c9%bd%a5%c7%a1%bc%a5%bf';
  const sources=[
    {type:'カバー',url:await discover(page,settings.wiki.home,settings.wiki.coverLinkText,fallbackCover)},
    {type:'オリジナル曲',url:await discover(page,settings.wiki.home,settings.wiki.originalLinkText,fallbackOriginal)}
  ];
  const all=[];
  for(const src of sources){
    log(`Wiki取得: ${src.type} ${src.url}`);
    await page.goto(src.url,{waitUntil:'networkidle',timeout:120000});
    const html=await page.content(); const $=cheerio.load(html);
    let rows=[]; $('table').each((_,t)=>rows.push(...parseTable($,t,src.type,src.url)));
    if(!rows.length){
      await page.screenshot({path:`output/wiki-${src.type}.png`,fullPage:true});
      await BunWriteFallback(`output/wiki-${src.type}.html`,html);
      throw new Error(`${src.type}ページから表を抽出できませんでした。診断HTML/画像をoutputに保存しました。`);
    }
    log(`Wiki抽出: ${src.type} ${rows.length}件`); all.push(...rows);
  }
  await browser.close();
  const map=new Map();
  for(const r of all){ const key=`${normalize(r.song)}|${[...r.singers].sort().join('|')}|${r.type}|${r.videoId}`; if(!map.has(key))map.set(key,r); }
  return [...map.values()];
}
async function BunWriteFallback(path,data){ const {writeFile,mkdir}=await import('node:fs/promises'); await mkdir('output',{recursive:true}); await writeFile(path,data); }
