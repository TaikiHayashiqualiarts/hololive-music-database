import fs from 'node:fs/promises';
import { stringify } from 'csv-stringify/sync';
import settings from '../config/settings.json' with { type: 'json' };
import { fetchWiki } from './wiki.js';
import { buildDatabase } from './database.js';
import { channelByHandle, uploads, videoDetails } from './youtube.js';
import { pushToSheets } from './sheets.js';

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) throw new Error('GitHub Secret YOUTUBE_API_KEY が未設定です。');

await fs.mkdir('output', { recursive: true });
const logs = [];
const log = message => {
  const row = { at: new Date().toISOString(), message };
  logs.push(row);
  console.log(message);
};

try {
  const wikiRows = await fetchWiki(settings, log);
  const wikiVideoIds = [...new Set(wikiRows.map(row => row.videoId).filter(Boolean))];
  log(`Wiki掲載YouTube動画ID: ${wikiVideoIds.length}件`);

  const extraVideoIds = [];
  if (settings.youtube.scanOfficialChannels) {
    for (const channelSetting of settings.youtube.officialChannels) {
      for (const handle of channelSetting.handles) {
        try {
          const channel = await channelByHandle(handle, apiKey);
          if (!channel) continue;
          log(`公式チャンネル走査: ${channel.title}`);
          extraVideoIds.push(...await uploads(channel.uploads, apiKey));
          break;
        } catch (error) {
          log(`チャンネル解決失敗 @${handle}: ${error.message}`);
        }
      }
    }
  }

  const allVideoIds = [...new Set([...wikiVideoIds, ...extraVideoIds])];
  const details = await videoDetails(allVideoIds, apiKey);
  const videos = [...details.values()];
  log(`YouTube詳細取得: ${videos.length}件`);

  const database = buildDatabase(wikiRows, videos, settings.videoRules);
  const headers = {
    songs: ['楽曲ID', '楽曲名', '歌唱者', '所属グループ', 'ソロ/ユニット', 'オリジナル/カバー', '初出日', '代表動画ID', '代表URL', '代表動画再生数', 'YouTubeチャンネル', 'Wikiソース', '照合状態', '最終更新日時'],
    talentRows: ['タレント名', '楽曲名', '所属グループ', 'ソロorユニット', 'オリジナルorカバー', 'アップロード日', 'YouTube再生数'],
    videos: ['楽曲ID', '動画ID', 'タイトル', '概要欄', '公開日時', '再生数', '動画時間秒', 'チャンネル', 'URL', '分類'],
  };

  const songRows = database.songs.map(song => Object.values(song));
  const talentRows = database.talentRows.map(row => Object.values(row));
  const videoRows = database.videos.map(video => [
    video.songId, video.videoId, video.title, video.description, video.publishedAt,
    video.viewCount, video.durationSeconds, video.channelTitle, video.url, video.classification,
  ]);

  await Promise.all([
    fs.writeFile('output/songs.csv', stringify([headers.songs, ...songRows], { bom: true })),
    fs.writeFile('output/talent_rows.csv', stringify([headers.talentRows, ...talentRows], { bom: true })),
    fs.writeFile('output/videos.csv', stringify([headers.videos, ...videoRows], { bom: true })),
    fs.writeFile('output/logs.json', JSON.stringify(logs, null, 2)),
  ]);

  const sheetsResult = await pushToSheets(
    process.env.SHEETS_WEB_APP_URL,
    process.env.SHEETS_WEB_APP_TOKEN,
    {
      spreadsheetId: settings.spreadsheetId,
      sheets: settings.sheets,
      data: {
        songs: { headers: headers.songs, rows: songRows },
        talentRows: { headers: headers.talentRows, rows: talentRows },
        videos: { headers: headers.videos, rows: videoRows },
        logs: { headers: ['日時', 'メッセージ'], rows: logs.map(row => [row.at, row.message]) },
      },
    },
  );

  log(`Sheets送信: ${sheetsResult.skipped ? '未設定のためスキップ' : '成功'}`);
  log(`完了: 楽曲 ${songRows.length} / タレント別 ${talentRows.length} / 動画 ${videoRows.length}`);
  await fs.writeFile('output/logs.json', JSON.stringify(logs, null, 2));
} catch (error) {
  log(`ERROR: ${error.stack || error.message || String(error)}`);
  await fs.writeFile('output/logs.json', JSON.stringify(logs, null, 2));
  throw error;
}
