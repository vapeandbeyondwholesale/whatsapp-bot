require("dotenv").config();
const { sendWhatsAppMessage } = require("./lib/whatsapp");

const { TEST_RECIPIENT_NUMBER } = process.env;

async function main() {
  if (!TEST_RECIPIENT_NUMBER) {
    console.error("Missing TEST_RECIPIENT_NUMBER in .env");
    process.exit(1);
  }

  try {
    const response = await sendWhatsAppMessage(
      TEST_RECIPIENT_NUMBER,
      "Hello! Ye test message hai WhatsApp Cloud API se."
    );
    console.log("Success! Message sent:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("Failed to send message:");
    console.error(JSON.stringify(error.response?.data || error.message, null, 2));
  }
}

main();
