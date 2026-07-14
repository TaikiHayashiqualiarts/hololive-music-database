const EXPECTED_SPREADSHEET_ID = '1TOOueIldd9LUc70RAbC_OPIWLhDhXvOX9ThG-6G36rw';

function setupReceiver() {
  const token = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('WEBHOOK_TOKEN', token);
  SpreadsheetApp.getActive().setSpreadsheetTimeZone('Asia/Tokyo');
  Logger.log('GitHub Secret SHEETS_WEB_APP_TOKEN に次を登録してください: ' + token);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ok:true,service:'hololive-music-database'})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');
    if (!expected || body.token !== expected) throw new Error('認証トークンが一致しません。');
    if (body.spreadsheetId !== EXPECTED_SPREADSHEET_ID) throw new Error('スプレッドシートIDが一致しません。');
    const ss = SpreadsheetApp.openById(EXPECTED_SPREADSHEET_ID);
    const names = body.sheets || {};
    write_(ss, names.songs || '楽曲DB', body.data.songs);
    write_(ss, names.talentRows || '楽曲一覧', body.data.talentRows);
    write_(ss, names.videos || '動画DB', body.data.videos);
    write_(ss, names.logs || '取得ログ', body.data.logs);
    return json_({ok:true,updatedAt:new Date().toISOString()});
  } catch (err) { return json_({ok:false,error:String(err && err.stack || err)}); }
}

function write_(ss, name, table) {
  if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) return;
  let sh=ss.getSheetByName(name); if(!sh)sh=ss.insertSheet(name);
  sh.clearContents();
  const values=[table.headers].concat(table.rows);
  if(values.length)sh.getRange(1,1,values.length,table.headers.length).setValues(values);
  sh.setFrozenRows(1); sh.getRange(1,1,1,table.headers.length).setFontWeight('bold'); sh.autoResizeColumns(1,table.headers.length);
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
