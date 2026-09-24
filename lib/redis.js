const { Redis } = require("@upstash/redis");

const MESSAGE_ID_TTL_SECONDS = 60 * 60 * 24; // 1 day - covers Meta's webhook retry window
const HISTORY_TTL_SECONDS = 60 * 60 * 24; // reset a customer's conversation memory after a day of inactivity
const MAX_HISTORY_MESSAGES = 10; // last 5 exchanges - keeps AI cost/latency bounded

let client;
let warned = false;

function getClient() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) {
      console.warn("Redis not configured - duplicate-check and conversation memory are disabled.");
      warned = true;
    }
    return null;
  }
  if (!client) {
    client = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
  }
  return client;
}

async function isDuplicateMessage(messageId) {
  const redis = getClient();
  if (!redis) return false;

  const wasSet = await redis.set(`wa:msgid:${messageId}`, "1", { nx: true, ex: MESSAGE_ID_TTL_SECONDS });
  return wasSet === null;
}

async function getConversationHistory(phone) {
  const redis = getClient();
  if (!redis) return [];

  const history = await redis.get(`wa:history:${phone}`);
  return history || [];
}

async function saveConversationHistory(phone, messages) {
  const redis = getClient();
  if (!redis) return;

  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES);
  await redis.set(`wa:history:${phone}`, trimmed, { ex: HISTORY_TTL_SECONDS });
}

module.exports = { isDuplicateMessage, getConversationHistory, saveConversationHistory };
