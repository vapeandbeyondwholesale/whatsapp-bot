const OpenAI = require("openai");
const SYSTEM_PROMPT = require("../business-info");
const shopify = require("./shopify");
const redis = require("./redis");

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
let client;

const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search the store's products by name or keyword. Returns matching products with price and a direct checkout link.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword, e.g. a product name or type" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "List the store's product categories so the customer can pick one to browse.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_products_in_category",
      description: "Get products inside a specific category, using the category handle from list_categories.",
      parameters: {
        type: "object",
        properties: {
          handle: { type: "string", description: "The category handle, e.g. 'disposable-vapes'" },
        },
        required: ["handle"],
      },
    },
  },
];

const PRODUCT_TOOLS = new Set(["search_products", "get_products_in_category"]);

async function callTool(name, args) {
  if (name === "search_products") {
    return shopify.searchProducts(args.query);
  }
  if (name === "list_categories") {
    return shopify.listCollections();
  }
  if (name === "get_products_in_category") {
    return shopify.getProductsInCollection(args.handle);
  }
  return { error: "Unknown tool" };
}

async function getReply(phone, userMessage) {
  if (!client) {
    client = new OpenAI();
  }

  const history = await redis.getConversationHistory(phone);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userMessage },
  ];

  let response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 500,
    messages,
    tools,
  });
  let choice = response.choices[0];
  let lastProducts = [];

  while (choice.finish_reason === "tool_calls") {
    messages.push(choice.message);

    for (const toolCall of choice.message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await callTool(toolCall.function.name, args);

      if (PRODUCT_TOOLS.has(toolCall.function.name) && Array.isArray(result)) {
        lastProducts = result;
      }

      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }

    response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      messages,
      tools,
    });
    choice = response.choices[0];
  }

  const replyText = choice.message.content || "";

  await redis.saveConversationHistory(phone, [
    ...history,
    { role: "user", content: userMessage },
    { role: "assistant", content: replyText },
  ]);

  return {
    text: replyText,
    products: lastProducts,
  };
}

module.exports = { getReply };
