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
          message = await followFunc(event);
          break;
      }
      // メッセージを返信
      if (message != undefined) {
        await sendFunc(body.events[0].replyToken, message);
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
  let message;
  switch (event.message.type) {
    case "message":
      message = await messagTextFunc(event);
      break;
      case 'image':
        message = await imageFunc(event);
        break;
    default:
      message = {
        type: "text",
        text: "エラーが発生しました。少し時間を開けてお試しください。",
      };
      break;
  }
  return message;
}

//普通のメッセージテキストが送られてきた時の関数
async function messagTextFunc(event) {
  const user_message = event.message.text;
  let return_message;
  if (
    user_message === "1" ||
    user_message === "2" ||
    user_message === "3" ||
    user_message === "4" ||
    user_message === "5" ||
    user_message === "6" ||
    user_message === "7" ||
    user_message === "8"
  ) {
    //${user_message}組で登録します。よろしいですかメッセージを送る。OKな場合はポストバックで送信する cancel&${user_message} or ok&${user_message}
  } else {
    //定型文を返す
    return_message = {
      type: "text",
      text:
        "モザイクアートを作るべく、玉川高校での思い出の写真を募集しています。是非このトークに写真を送ってください。質問などは個別に対応していませんが、お問い合わせ内容の頭に # を付けて送っていただくと対応いたします。",
    };
  }
}

//画像をs3に投げる関数
async function imageFunc(event){

}

async function followFunc(event) {
  //クラスを選択してくださいメッセージも送る
  return [
    {
      type: "text",
      text:
        "追加ありがとうございます！みんなで画像を集めて卒業記念のモザイクアートを完成させましょう！ご協力ください",
    },
  ];
}

//クラスが決定した時にDBにユーザーIDとクラス番号を保存する関数
async function postbackFunc(event) {
  //splitで頭文字を取得する
  //頭文字が # or ＃ だった場合notifyを管理者グループに飛ばす

  //event.message.textを.split('&')してできた配列[0]で判定する
  //[0] === 'cancel'なら友達追加した時に送ったメッセージを送る
  //[0] === 'ok'　なら [1]のクラスをdynamoDBに保存する
}
