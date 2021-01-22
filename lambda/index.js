"use strict";
// モジュール呼び出し
const crypto = require("crypto");
const line = require("@line/bot-sdk");
const AWS = require("aws-sdk");
const axios = require("axios");
const privatekey = require("./privatekey.json");
const querystring = require("querystring");
const { google } = require("googleapis");

// インスタンス生成
const client = new line.Client({ channelAccessToken: process.env.ACCESSTOKEN });

const docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = (event) => {
  const signature = crypto
    .createHmac("sha256", process.env.CHANNELSECRET)
    .update(event.body)
    .digest("base64");
  const checkHeader = (event.headers || {})["X-Line-Signature"];
  const body = JSON.parse(event.body);
  const events = body.events;

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
        case "unfollow":
          //リッチメニューを初期化する
          break;
      }
      if (message !== undefined) {
        client.replyMessage(event.replyToken, message);
      }
      return;
    });
  }
  // 署名検証に失敗した場合
  else {
    console.log("署名認証エラー");
  }
};

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
      message = {
        type: "text",
        text: "動画は現在受け付けていないです!!画像をお願いします!!",
      };
      break;
    case "sticker":
      message = await stickerFunc(event);
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
    return_message = await notify(event);
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
  } else if (user_message === "画像を送る") {
    return_message = bosyuMessage();
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

//グーグルにログインし、コンテンツを取得してドライブにアップロードする
async function imageFunc(event) {
  const date = new Date();
  const stamp = date.getTime();
  let message;
  //DBからクラスを取得する

  //クラスの取得に失敗した場合は、クラスを設定してくださいメッセージを返す

  //クラスがわかった場合
  const imageId = await Promise.resolve()
    .then(function () {
      return new Promise(function (resolve, reject) {
        //JWT auth clientの設定
        const jwtClient = new google.auth.JWT(
          privatekey.client_email,
          null,
          privatekey.private_key,
          ["https://www.googleapis.com/auth/drive"]
        );
        //authenticate request
        jwtClient.authorize(function (err, tokens) {
          if (err) {
            reject(err);
          } else {
            //認証成功
            resolve(jwtClient);
          }
        });
      });
    })
    .then(function (jwtClient) {
      return new Promise(async function (resolve, reject) {
        const drive = google.drive({ version: "v3", auth: jwtClient });
        const imageStream = await client.getMessageContent(event.message.id);
        //ファイル名は${classNumber}-${event.source.userId}-${stamp}.jpg
        //保存先はクラスに応じて変える
        var fileMetadata = {
          name: `jwt-${event.source.userId}-${stamp}.jpg`,
          parents: ["1OvCSUaVTUfTQ-aSidn9lOOa0oHKYKcWl"],
        };
        var media = {
          mimeType: "image/jpeg",
          body: imageStream,
        };
        await drive.files.create(
          {
            resource: fileMetadata,
            media: media,
            fields: "id",
          },
          function (err, file) {
            if (err) {
              // Handle error
              console.error(err);
            } else {
              resolve(file.data.id);
            }
          }
        );
      });
    });
  message = {
    type: "text",
    text: `写真を1枚受け付けました!!目指せ1000枚!!🔥`,
  };

  //クラスがわからなかった場合

  //DBのpictureプロパティに1追加する
  const updateParams = {
    TableName: "graduation-pj",
    Key: {
      userId: event.source.userId,
    },
    ExpressionAttributeNames: {
      "#p": "picture",
    },
    ExpressionAttributeValues: {
      ":addPower": 1, //engineのpower属性に92を足す
    },
    UpdateExpression: "SET #p = #p + :addPower",
  };
   docClient.update(updateParams).promise();

  //メッセージを返す
  return message;
}

async function followFunc() {
  //クラスを選択してくださいメッセージも送る
  const chooseClassMessage = choseClassMessage();

  //DBのスコアを0にする
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
        type: "class",
        classNumber: user_postback_data[1],
        picture: 0,
        name: profile.displayName,
      },
    };
    docClient.put(putParams).promise();
    //リッチメニューをデフォルトにセットする

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
    altText: "クラスを設定してください",
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

//募集を促すメッセージを返す関数
function bosyuMessage() {
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
            text: "【玉高の思い出】写真募集中!!",
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
                  type: "uri",
                  label: "送る画像を選ぶ",
                  uri: "https://line.me/R/nv/cameraRoll/multi",
                },
                color: "#7DE8F0",
                style: "primary",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            spacing: "none",
            margin: "none",
            contents: [
              {
                type: "text",
                text: "※高校生活に思い出のある画像の募集です",
                size: "sm",
                contents: [],
              },
            ],
          },
        ],
      },
    },
  };
}

//ステッカーを一つランダムに返す関数
async function stickerFunc(event) {
  let message;
  let randomNumber = Math.floor(Math.random() * 11); // 0~10の乱数を生成

  const stickerMesArry = [
    {
      type: "sticker",
      packageId: "11539",
      stickerId: "52114122",
    },
    {
      type: "sticker",
      packageId: "11537",
      stickerId: "52002735",
    },
    {
      type: "sticker",
      packageId: "11537",
      stickerId: "52002759",
    },
    {
      type: "sticker",
      packageId: "11537",
      stickerId: "52002767",
    },
    {
      type: "sticker",
      packageId: "11537",
      stickerId: "52002768",
    },
    {
      type: "sticker",
      packageId: "11537",
      stickerId: "52002771",
    },
    {
      type: "sticker",
      packageId: "11537",
      stickerId: "52002738",
    },
    {
      type: "sticker",
      packageId: "11538",
      stickerId: "51626503",
    },
    {
      type: "sticker",
      packageId: "11538",
      stickerId: "51626518",
    },
    {
      type: "sticker",
      packageId: "11539",
      stickerId: "52114125",
    },
  ];
  message = stickerMesArry[randomNumber];
  return message;
}

//お問い合わせを送る関数
async function notify(event) {
  let return_message;
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
    text: "運営へ連絡を送っておきました。返信がくるまでしばしお待ちください。",
  };
  return return_message;
}
