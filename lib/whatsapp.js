const axios = require("axios");

function apiUrl() {
  const { PHONE_NUMBER_ID } = process.env;
  return `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function sendWhatsAppMessage(to, text) {
  return axios.post(
    apiUrl(),
    { messaging_product: "whatsapp", to, type: "text", text: { body: text } },
    { headers: authHeaders() }
  );
}

async function sendWhatsAppImage(to, imageUrl, caption) {
  return axios.post(
    apiUrl(),
    { messaging_product: "whatsapp", to, type: "image", image: { link: imageUrl, caption } },
    { headers: authHeaders() }
  );
}

module.exports = { sendWhatsAppMessage, sendWhatsAppImage };
