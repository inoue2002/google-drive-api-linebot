"use strict";
const fs = require("fs");
const express = require("express");
const line = require("@line/bot-sdk");
const PORT = process.env.PORT || 3000;
const dotenv = require("dotenv");
const { google } = require("googleapis");
const readline = require("readline");
const axios = require("axios");
const Request = require("request");

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};


const app = express();

app.get("/", (req, res) => res.send("Hello（GET)"));
app.post("/webhook", line.middleware(config), (req, res) => {
  console.log(req.body.events);

  if (
    req.body.events[0].replyToken === "00000000000000000000000000000000" &&
    req.body.events[1].replyToken === "ffffffffffffffffffffffffffffffff"
  ) {
    res.send("Hello!(POST)");
    console.log("疎通確認用");
    return;
  }

  Promise.all(req.body.events.map(handleEvent)).then((result) =>
    res.json(result)
  );
});

const client = new line.Client(config);

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_PATH = "token.json";

async function handleEvent(event) {
  let contents = "";
  if (event.message.type === "image") {
    console.log("画像ID", event.message.id);
    //コンテンツIDからデータを取得
    //モジュールではなく、axiosを使う

    //バイナリデータが返される
    //console.log(contentsData.data);

    //requestモジュールでコンテンツ取得APIを叩く
    // const options = {
    //   url: `https://api.line.me/v2/bot/message/${event.message.id}/content`,
    //   method: "get",
    //   headers: {
    //     Authorization: "Bearer " + process.env.CHANNEL_ACCESS_TOKEN,
    //   },
    //   encoding: null,
    // };
    // Request(options, async function (error, response, body) {
    //   if (!error && response.statusCode == 200) {
    //     console.log(body);
    //     contents = body;
    //     fs.writeFileSync(`./image.jpg`, body, "binary");
    //     console.log("file saved");
    //
    //   }
    // });

    await authorize(listFiles);
    async function authorize(callback) {
      const oAuth2Client = new google.auth.OAuth2(
        process.env.client_id,
        process.env.client_secret,
        process.env.redirect_uris
      );

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, (err, token) => {
        console.log(`token` ,token)
        if (err) {
          console.log(err);
          return getAccessToken(oAuth2Client, callback);
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
      });
    }
    async function getAccessToken(oAuth2Client, callback) {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
      });
      console.log("Authorize this app by visiting this url:", authUrl);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("Enter the code from that page here: ", (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) return console.error("Error retrieving access token", err);
          oAuth2Client.setCredentials(token);
          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log("Token stored to", TOKEN_PATH);
          });
          callback(oAuth2Client);
        });
      });
    }
    async function listFiles(auth) {
      console.log(auth)
      console.log(event);
      let string = Buffer.from(contents, `base64`);
      string = string.toString();
      // console.log(2);

      const drive = google.drive({ version: "v3", auth });
     

      //const imageStream = await client.getMessageContent('13421968197698');
      var fileMetadata = {
        name: `${event.source.userId}.jpg`,
        parents: ["1OvCSUaVTUfTQ-aSidn9lOOa0oHKYKcWl"],
      };
      var media = {
        mimeType: "image/jpeg",
        body: imageStream,
      };
      drive.files.create(
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
            console.log("File Id: ", file.data.id);
            client.replyMessage(event.replyToken,{type:'text',text:`保存に成功したよ！https://drive.google.com/uc?id=${file.data.id}`})
          }
        }
      );
    }
  } else if (event.message.type === "text") {
  client.replyMessage(event.replyToken,{type:'text',text:event.message.text})
  }
}

app.listen(PORT);
console.log(`Server running at ${PORT}`);
