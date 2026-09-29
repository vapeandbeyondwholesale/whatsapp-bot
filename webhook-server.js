require("dotenv").config();
const express = require("express");
const { webhookHandler } = require("./lib/webhookHandler");

const app = express();
app.use(express.json());
app.all("/webhook", webhookHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Webhook server running on http://localhost:${port}/webhook`);
});
