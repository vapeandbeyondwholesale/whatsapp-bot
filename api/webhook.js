require("dotenv").config();
const { webhookHandler } = require("../lib/webhookHandler");

module.exports = webhookHandler;
