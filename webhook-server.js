require("dotenv").config();
const express = require("express");
const { sendWhatsAppMessage, sendWhatsAppImage } = require("./lib/whatsapp");
const { getReply } = require("./lib/ai");
const redis = require("./lib/redis");

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, PORT } = process.env;

// Meta webhook verification (GET request jab aap Meta Dashboard mein webhook URL set karte hain)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("Webhook verified successfully.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Incoming WhatsApp messages yahan aayenge
app.post("/webhook", (req, res) => {
  res.sendStatus(200); // Meta ko turant acknowledge karein warna wo retry karega

  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return;
  }

  const from = message.from;
  const text = message.text.body;

  processIncomingMessage(message.id, from, text);
});

async function processIncomingMessage(messageId, from, text) {
  const isDuplicate = await redis.isDuplicateMessage(messageId);
  if (isDuplicate) {
    return;
  }

  console.log(`Incoming from ${from}: ${text}`);
  await handleIncomingMessage(from, text);
}

async function handleIncomingMessage(from, text) {
  try {
    const { text: replyText, products } = await getReply(from, text);

    if (replyText) {
      await sendWhatsAppMessage(from, replyText);
    }

    for (const product of products) {
      const caption = `*${product.title}*\n${product.currency} ${product.price}\n${product.checkoutLink}`;
      if (product.image) {
        await sendWhatsAppImage(from, product.image, caption);
      } else {
        await sendWhatsAppMessage(from, caption);
      }
    }

    console.log(`Replied to ${from}: ${replyText}`);
  } catch (error) {
    console.error("Error handling message:", error.response?.data || error.message);
  }
}

const port = PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server running on http://localhost:${port}/webhook`);
});
