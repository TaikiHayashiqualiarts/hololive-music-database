# hololive-music-database — Phase 1

非公式Wikiを主データとして読み込み、Wikiに掲載されたYouTube動画IDをYouTube Data APIで照合し、曲単位のCSVを生成します。

## このPhaseで実装済み

- Playwright（Chromium）によるSeesaa Wiki取得
- 表・リスト・本文行の3方式によるWiki解析
- 取得HTML、本文、スクリーンショットの診断保存
- Wiki掲載YouTube動画の公開日、再生数、動画時間、チャンネル取得
- 曲単位の `songs.csv`
- タレント別展開の `talent_rows.csv`
- 曲と動画の紐付け `videos.csv`
- GoogleスプレッドシートWeb Appへの送信
- 毎日0時（Asia/Tokyo）のGitHub Actions

## 現時点の範囲

Phase 1ではWikiに掲載された動画IDを中心に照合します。全タレント公式チャンネル、Topicチャンネル、Wiki未掲載動画の網羅走査はPhase 2で追加します。

## GitHub Actionsファイル

同梱の `update.yml` の内容を、GitHub上の `.github/workflows/update.yml` に貼り付けてください。

## 必要なSecrets

- `YOUTUBE_API_KEY`
- `SHEETS_WEB_APP_URL`（スプレッドシート反映を始める段階で追加）
- `SHEETS_WEB_APP_TOKEN`（スプレッドシート反映を始める段階で追加）

`SHEETS_WEB_APP_URL` と `SHEETS_WEB_APP_TOKEN` が未設定でも、CSV生成までは動きます。
