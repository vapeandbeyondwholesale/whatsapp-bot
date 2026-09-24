const axios = require("axios");

const API_VERSION = "2025-10";

function shopifyGraphQL(query, variables = {}) {
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN } = process.env;
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

  return axios.post(
    url,
    { query, variables },
    {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    }
  );
}

function numericIdFromGid(gid) {
  return gid.split("/").pop();
}

function buildCheckoutLink(variantGid, quantity = 1) {
  const { SHOPIFY_STORE_DOMAIN } = process.env;
  const variantId = numericIdFromGid(variantGid);
  return `https://${SHOPIFY_STORE_DOMAIN}/cart/${variantId}:${quantity}`;
}

function formatProduct(node) {
  const variant = node.variants.edges[0]?.node;
  return {
    title: node.title,
    price: node.priceRangeV2.minVariantPrice.amount,
    currency: node.priceRangeV2.minVariantPrice.currencyCode,
    image: node.featuredImage?.url || null,
    checkoutLink: variant ? buildCheckoutLink(variant.id) : null,
  };
}

async function searchProducts(searchTerm, limit = 5) {
  const query = `
    query SearchProducts($searchQuery: String!, $first: Int!) {
      products(first: $first, query: $searchQuery) {
        edges {
          node {
            title
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            featuredImage { url }
            variants(first: 1) {
              edges { node { id } }
            }
          }
        }
      }
    }
  `;

  const response = await shopifyGraphQL(query, {
    searchQuery: `title:*${searchTerm}* OR tag:*${searchTerm}*`,
    first: limit,
  });

  return response.data.data.products.edges.map(({ node }) => formatProduct(node));
}

async function listCollections(limit = 20) {
  const query = `
    query ListCollections($first: Int!) {
      collections(first: $first) {
        edges { node { title handle } }
      }
    }
  `;
  const response = await shopifyGraphQL(query, { first: limit });
  return response.data.data.collections.edges.map(({ node }) => node);
}

async function getProductsInCollection(handle, limit = 10) {
  const query = `
    query CollectionProducts($handle: String!, $first: Int!) {
      collectionByHandle(handle: $handle) {
        products(first: $first) {
          edges {
            node {
              title
              priceRangeV2 { minVariantPrice { amount currencyCode } }
              featuredImage { url }
              variants(first: 1) {
                edges { node { id } }
              }
            }
          }
        }
      }
    }
  `;
  const response = await shopifyGraphQL(query, { handle, first: limit });
  const collection = response.data.data.collectionByHandle;
  if (!collection) return [];

  return collection.products.edges.map(({ node }) => formatProduct(node));
}

module.exports = { searchProducts, listCollections, getProductsInCollection };
