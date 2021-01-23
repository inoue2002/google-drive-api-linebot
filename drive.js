"use strict";
const fs = require("fs");
const express = require("express");
const line = require("@line/bot-sdk");
const PORT = process.env.PORT || 5000;
const dotenv = require("dotenv");
const { google } = require("googleapis");
const readline = require("readline");
const axios = require("axios");
const Request = require("request");
const privatekey = require("./privatekey.json");
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

    const imageId =await Promise.resolve()
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
              console.log("認証成功");
              resolve(jwtClient);
            }
          });
        });
      })
      .then(function (jwtClient) {
        return new Promise(async function (resolve, reject) {
          const drive = google.drive({ version: "v3", auth: jwtClient });
          const imageStream =　await client.getMessageContent(event.message.id)
          var fileMetadata = {
            name: `jwt-${event.source.userId}.jpg`,
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
                resolve(file.data.id)
              }
            }
          );
        });
      });
      client.replyMessage(event.replyToken, {
        type: "text",
        text: `保存に成功したよ！https://drive.google.com/uc?id=${imageId}`,
      });
  }
}

app.listen(PORT);
console.log(`Server running at ${PORT}`);
