"use strict";
// モジュール呼び出し
const crypto = require("crypto");
const line = require("@line/bot-sdk");

// インスタンス生成
const client = new line.Client({ channelAccessToken: process.env.ACCESSTOKEN });

exports.handler = (event) => {
  const signature = crypto
    .createHmac("sha256", process.env.CHANNELSECRET)
    .update(event.body)
    .digest("base64");
  const checkHeader = (event.headers || {})["X-Line-Signature"];
  const body = JSON.parse(event.body);
  const events = body.events;
  console.log(events);

  // 署名検証が成功した場合
  if (signature === checkHeader) {
    events.forEach(async (event) => {
      let message;
      switch (event.type) {
        case "message":
          message = await messageFunc(event);
          break;
          case "postback":
            message = await postbackFunc(event);
            break;
        case "follow":
            message = await followFunc(event)
          break;
      }
      // メッセージを返信
      if (message != undefined) {
        await sendFunc(body.events[0].replyToken, message)
         // .then(console.log)
         // .catch(console.log);
        return;
      }
    });
  }
  // 署名検証に失敗した場合
  else {
    console.log("署名認証エラー");
  }
};

async function sendFunc(replyToken, mes) {
  const result = new Promise(function (resolve, reject) {
    client.replyMessage(replyToken, mes).then((response) => {
      resolve("送信完了");
    });
  });
  return result;
}

async function messageFunc(event) {
  let message = "";
  message = { type: "text", text: `メッセージイベント` };
  return message;
}

async function followFunc(event){
    //クラスを選択してくださいメッセージも送る
return  [{ type: "text", text: "追加ありがとうございます！みんなで画像を集めて卒業記念のモザイクアートを完成させましょう！ご協力ください" }];
}

//クラスが決定した時にDBにユーザーIDとクラス番号を保存する関数
async function postbackFunc(event){

}