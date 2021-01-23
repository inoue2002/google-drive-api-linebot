# google-drive-api-linebot
googleDriveへのアップロードをLINEBotから行いたい

drive.jsを使ってngrokを用いて画像アップロードを試すことができる。
まずは[google developer console](https://console.developers.google.com/)よりサービスアカウントを作成し、認証情報JSONを取得する
プロジェクト直下に`privatekley.json`を作成し、ダウンロードしたJSONを貼り付ける
そして、アップロードしたいgoogleDriveのフォルダーIDを取得&共有からユーザー招待でサービスアカウントのメールアドレスから編集者にする。
そして`node drive.js` `ngrok http 5000`を叩いて発行されたurlをlineコンソールで`https://xxxx.ngrok.io/webhook`のように入力する
LINEBotに画像を送って、保存されたら成功