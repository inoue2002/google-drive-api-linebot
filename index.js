"use strict";
const fs = require("fs");
const express = require("express");
const line = require("@line/bot-sdk");
const PORT = process.env.PORT || 3000;
const dotenv = require("dotenv");
const { google } = require("googleapis");
const readline = require("readline");

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

const SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"];
const TOKEN_PATH = "token.json";

async function handleEvent(event) {
  if (event.message.type === "image") {
    console.log("画像ID", event.message.id);
    //コンテンツIDからデータを取得
    await client.getMessageContent(event.message.id).then(async (stream) => {
      console.log(`1`);
      console.log(Object.keys(stream));
      stream.on("data", async (chunk) => {
        console.log(2);
        //bufferからbase64にでコード
        const base64 = chunk.toString("base64");
        // console.log(base64);

        await fs.readFile("credentials.json", async (err, content) => {
          // console.log(1);
          if (err) return console.log("Error loading client secret file:", err);
          // Authorize a client with credentials, then call the Google Drive API.
          await authorize(JSON.parse(content), listFiles);
        });

        async function authorize(credentials, callback) {
          const client_secret = process.env.client_secret;
          const client_id = process.env.client_id;
          const redirect_uris = process.env.redirect_uris;

          const oAuth2Client = new google.auth.OAuth2(
            client_id,
            client_secret,
            redirect_uris
          );

          // Check if we have previously stored a token.
          await fs.readFile(TOKEN_PATH, (err, token) => {
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
              if (err)
                return console.error("Error retrieving access token", err);
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

        function listFiles(auth) {
          // console.log(2);
          const drive = google.drive({ version: "v3", auth });

          var fileMetadata = {
            name: "photo.jpg",
            //parents: ['16ag9BocOs3Fna22jqibXnVcguWvaNiXq']
          };
          var media = {
            mimeType: "image/jpeg",
            body: fs.createReadStream("files/photo.jpg"),
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
                console.log("File Id: ", file.id);
              }
            }
          );

          /*
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
                  console.log("File Id: ", file.id);
                }
              }
            )
            */
        }
      });
    });
  } else {
    //動作確認で鸚鵡返し
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: event.message.text,
    });
  }
}

app.listen(PORT);
console.log(`Server running at ${PORT}`);
