const { sendWhatsAppMessage, sendWhatsAppImage } = require("./whatsapp");
const { getReply } = require("./ai");
const redis = require("./redis");

// Serverless-safe: everything is awaited before responding, since platforms
// like Vercel can freeze/terminate the function right after the response is sent.
async function webhookHandler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log("Webhook verified successfully.");
      res.status(200).send(challenge);
    } else {
      res.status(403).end();
    }
    return;
  }

  if (req.method === "POST") {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== "text") {
      res.status(200).end();
      return;
    }

    const isDuplicate = await redis.isDuplicateMessage(message.id);
    if (isDuplicate) {
      res.status(200).end();
      return;
    }

    const from = message.from;
    const text = message.text.body;
    console.log(`Incoming from ${from}: ${text}`);

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

    res.status(200).end();
    return;
  }

  res.status(405).end();
}

module.exports = { webhookHandler };
