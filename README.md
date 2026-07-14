# hololive-music-database

非公式Wikiを主データ、YouTube Data APIを補完データとして、曲単位のホロライブ楽曲DBを生成し、Googleスプレッドシートへ反映します。

設定済み:
- Spreadsheet ID: `1TOOueIldd9LUc70RAbC_OPIWLhDhXvOX9ThG-6G36rw`
- 出力シート: `楽曲DB` / `楽曲一覧` / `動画DB` / `取得ログ`
- 更新時刻: 毎日 00:00 Asia/Tokyo（GitHub Actions cronは15:00 UTC）

## 1. GitHubへアップロード

このZIPを展開し、リポジトリの **Add file → Upload files** から、中身をフォルダ構造のままアップロードします。

## 2. YouTube APIキー

Google Cloud Consoleで YouTube Data API v3 を有効にし、APIキーを作ります。GitHubの
`Settings → Secrets and variables → Actions → New repository secret` に以下を登録します。

- Name: `YOUTUBE_API_KEY`
- Secret: 作成したAPIキー

APIキーをREADMEやコードへ直接書かないでください。

## 3. スプレッドシート受信GAS

対象スプレッドシートを開き、`拡張機能 → Apps Script` へ `gas/Code.gs` 全文を貼ります。

1. `setupReceiver` を実行
2. 実行ログに出た長いトークンをコピー
3. `デプロイ → 新しいデプロイ → ウェブアプリ`
4. 実行するユーザー: 自分
5. アクセスできるユーザー: 全員
6. デプロイ後の `/exec` URLをコピー

GitHub Secretsへ登録:
- `SHEETS_WEB_APP_URL`: `/exec` URL
- `SHEETS_WEB_APP_TOKEN`: `setupReceiver` のログに出たトークン

URLが全員アクセス可でも、正しいトークンがないPOSTは拒否されます。

## 4. 初回実行

GitHubリポジトリで `Actions → Update Hololive Music Database → Run workflow`。

成功すると、スプレッドシートの指定4シートだけを全置換します。他のシートは削除しません。

## 判定ルール

- Wiki掲載行を楽曲マスターとする
- YouTube動画IDがWikiにある場合は最優先で照合
- 動画時間 1:30〜6:00
- Shorts、生配信、歌枠、ライブ映像、公式切り抜き、Instrumental/Off Vocalを除外
- 複数歌唱者はユニット、1名はソロ
- Wikiページ種別をオリジナル/カバーの主判定にする
- MV、Topic、アルバム自動生成音源など複数動画は同一曲へ紐付け、代表動画は再生数最大を採用

## 注意

Seesaa WikiのHTML構造が変わった場合、取得失敗時に `output/wiki-*.html` と画像が保存されるため、GitHub Actionsの出力で診断できます。
