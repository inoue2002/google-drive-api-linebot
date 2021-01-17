"use strict";
// モジュール呼び出し
const crypto = require("crypto");
const line = require("@line/bot-sdk");
const AWS = require("aws-sdk");
const Request = require("request");
const axios = require("axios");
const { head } = require("request");
const querystring = require("querystring");

// インスタンス生成
const client = new line.Client({ channelAccessToken: process.env.ACCESSTOKEN });

const s3 = new AWS.S3({
  region: "ap-northeast-1",
  apiVersion: "2012-08-10",
  accessKeyId: process.env.S3ID,
  secretAccessKey: process.env.S3KEY,
});
const docClient = new AWS.DynamoDB.DocumentClient();

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
      console.log(`起動`);
      let message;
      switch (event.type) {
        case "message":
          message = await messageFunc(event);
          break;
        case "postback":
          message = await postbackFunc(event);
          break;
        case "follow":
          message = await followFunc();
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
    case "text":
      message = await textFunc(event);
      break;
    case "image":
      message = await imageFunc(event);
      break;
    case "video":
      message = { type: "text", text: "動画は現在受け付けていないです!!画像をお願いします!!" };
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
async function textFunc(event) {
  const user_message = event.message.text;
  let return_message;
  //splitで頭文字を取得する
  //頭文字が # or ＃ だった場合notifyを管理者グループに飛ばす
  const headText = user_message.split("");
  if (headText[0] === "#" || headText === "＃") {
    const profile = await client.getProfile(event.source.userId);
    //linebotifyを飛ばす
    axios.post(
      "https://notify-api.line.me/api/notify",
      querystring.stringify({
        message: `${profile.displayName}さんからお問い合わせ[${event.message.text}]`,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Bearer " + process.env.NotifyToken,
        },
      }
    );
    return_message = {
      type: "text",
      text:
        "運営へ連絡を送っておきました。返信がくるまでしばしお待ちください。",
    };
  } else if (
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
    return_message = submittClassMessage(event.message.text);
  } else {
    //定型文を返す
    return_message = {
      type: "text",
      text:
        "モザイクアートを作るべく、玉川高校での思い出の写真を募集しています。是非このトークに写真を送ってください。質問などは個別に対応していませんが、お問い合わせ内容の頭に # を付けて送っていただくと対応いたします。",
    };
  }
  return return_message;
}

//画像をs3に投げる関数
async function imageFunc(event) {
  const date = new Date();
  const stamp = date.getTime();

  const upImageParams = {
    Bucket: "graduation-pj",
    Key: `${event.source.userId}_${stamp}.jpg`,
  };

  upImageParams.Body = await downloadFunc(event);
  const res = await s3.putObject(upImageParams).promise();
  if (res.ETag !== undefined) {
    return null;
  }
}
//コンテンツを取得する
function downloadFunc(event) {
  return new Promise((resolve, reject) => {
    const options = {
      url: `https://api.line.me/v2/bot/message/${event.message.id}/content`,
      method: "get",
      headers: {
        Authorization: "Bearer " + process.env.ACCESSTOKEN,
      },
      encoding: null,
    };
    Request(options, (error, response, body) => {
      if (error) reject(error);
      if (response.statusCode != 200) {
        reject("Invalid status code <" + response.statusCode + ">");
      }
      resolve(body);
    });
  });
}

async function followFunc() {
  //クラスを選択してくださいメッセージも送る
  const chooseClassMessage = choseClassMessage();
  return [
    {
      type: "text",
      text:
        "追加ありがとうございます！みんなで画像を集めて卒業記念のモザイクアートを完成させましょう！ご協力ください",
    },
    chooseClassMessage,
  ];
}

//クラスが決定した時にDBにユーザーIDとクラス番号を保存する関数
async function postbackFunc(event) {
  let return_message;
  //event.message.textを.split('&')してできた配列[0]で判定する
  const user_postback_data = event.postback.data.split("&");
  if (user_postback_data[0] === "ok") {
    //DBにユーザーIDとクラス(user_postback_data[1])を保存する
    const profile = await client.getProfile(event.source.userId);

    const putParams = {
      TableName: "graduation-pj",
      Item: {
        userId: event.source.userId,
        classNumber: user_postback_data[1],
        name: profile.displayName,
      },
    };
    docClient.put(putParams).promise();
    return_message = {
      type: "text",
      text: `${profile.displayName}さんを${user_postback_data[1]}組として登録しました。`,
    };
  } else if (user_postback_data[0] === "cancel") {
    return_message = choseClassMessage();
  } else {
    return_message = {
      type: "text",
      text: "エラーが発生しました。時間を開けてから再度お試しください。",
    };
  }
  return return_message;
}

//クラス選択のメッセージを返す関数
function choseClassMessage() {
  return {
    type: "flex",
    altText: "flexMessageです",
    contents: {
      type: "bubble",
      direction: "ltr",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        borderWidth: "10px",
        borderColor: "#E8F07D",
        cornerRadius: "5px",
        contents: [
          {
            type: "text",
            text: "あなたのクラスを教えてください",
            weight: "bold",
            size: "md",
            align: "center",
            margin: "none",
            contents: [],
          },
          {
            type: "separator",
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "md",
            contents: [
              {
                type: "button",
                action: {
                  type: "message",
                  label: "1",
                  text: "1",
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "2",
                  text: "2",
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "3",
                  text: "3",
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "4",
                  text: "4",
                },
                color: "#7DE8F0",
                style: "primary",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "md",
            contents: [
              {
                type: "button",
                action: {
                  type: "message",
                  label: "5",
                  text: "5",
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "6",
                  text: "6",
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "7",
                  text: "7",
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "message",
                  label: "8",
                  text: "8",
                },
                color: "#7DE8F0",
                style: "primary",
              },
            ],
          },
        ],
      },
    },
  };
}
//クラス決定のメッセージ返す関数
function submittClassMessage(classNmber) {
  return {
    type: "flex",
    altText: `あなたは${classNmber}ですか？`,
    contents: {
      type: "bubble",
      direction: "ltr",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        borderWidth: "10px",
        borderColor: "#E8F07D",
        cornerRadius: "5px",
        contents: [
          {
            type: "text",
            text: `${classNmber}組で間違いないですか？`,
            weight: "bold",
            size: "md",
            align: "center",
            margin: "none",
            contents: [],
          },
          {
            type: "separator",
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "md",
            contents: [
              {
                type: "button",
                action: {
                  type: "postback",
                  label: "はい",
                  data: `ok&${classNmber}`,
                },
                color: "#7DE8F0",
                style: "primary",
              },
              {
                type: "button",
                action: {
                  type: "postback",
                  label: "キャンセル",
                  data: `cancel&${classNmber}`,
                },
                color: "#C0D9DAFF",
                style: "primary",
              },
            ],
          },
        ],
      },
    },
  };
}
