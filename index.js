require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
const twilio = require("twilio");

const analyzeComplaint = require("./gemini");
const db = require("./firebase");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const ACCOUNT_SID = process.env.ACCOUNT_SID;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

app.post("/whatsapp", async (req, res) => {
  console.log("Incoming:", req.body);

  const from = req.body.From;

  // Immediate acknowledgement to Twilio
  res.set("Content-Type", "text/xml");
  res.send(`
<Response>
  <Message>Your complaint is being processed. You will receive an update shortly.</Message>
</Response>
`);

  /* =======================
     TEXT MESSAGE HANDLING
     ======================= */
  if (req.body.NumMedia === "0" && req.body.Body) {
    const text = req.body.Body.trim();
    console.log("Text complaint received:", text);

    try {
      const analysis = await analyzeComplaint(text);
      console.log("Text analysis:", analysis);

      await db.collection("complaints").add({
        phone: from,
        transcript: text,
        analysis,
        createdAt: new Date(),
        status: "new",
        mode: "text"
      });

      await client.messages.create({
        from: "whatsapp:+14155238886",
        to: from,
        body:
`Complaint received:
${text}

Analysis:
${analysis}

Status: Recorded`
      });

      console.log("Text complaint saved and WhatsApp reply sent");
    } catch (err) {
      console.error("Text complaint error:", err);
    }

    return;
  }

  /* =======================
     VOICE MESSAGE HANDLING
     ======================= */
  if (req.body.NumMedia === "1") {
    const audioUrl = req.body.MediaUrl0;
    const audioPath = path.join(__dirname, `audio_${Date.now()}.ogg`);

    console.log("Voice complaint detected");

    try {
      const response = await axios.get(audioUrl, {
        responseType: "stream",
        auth: {
          username: ACCOUNT_SID,
          password: AUTH_TOKEN
        }
      });

      const writer = fs.createWriteStream(audioPath);
      response.data.pipe(writer);

      writer.on("finish", () => {
        console.log("Audio downloaded:", audioPath);

        exec(`python transcribe.py "${audioPath}"`, async (err, stdout, stderr) => {
          if (err) {
            console.error("Transcription error:", err);
            return;
          }

          const transcript = stdout.trim();
          console.log("Transcript:", transcript);

          try {
            const analysis = await analyzeComplaint(transcript);
            console.log("Voice analysis:", analysis);

            await db.collection("complaints").add({
              phone: from,
              transcript,
              analysis,
              createdAt: new Date(),
              status: "new",
              mode: "voice"
            });

            await client.messages.create({
              from: "whatsapp:+14155238886",
              to: from,
              body:
`Heard:
${transcript}

Analysis:
${analysis}

Status: Recorded`
            });

            console.log("Voice complaint saved and WhatsApp reply sent");
          } catch (aiErr) {
            console.error("Voice analysis error:", aiErr);
          } finally {
            fs.unlink(audioPath, () => {});
            console.log("Audio file cleaned up");
          }
        });
      });

    } catch (e) {
      console.error("Audio download error:", e);
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`JadiSan running on port ${PORT}`);
});

