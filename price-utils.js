// ============================================================
// price-utils.js
// Shared pricing logic: turning item names into warframe.market
// slugs, fetching lowest sell prices, and running the best-of-4
// relic value calculation. Used by any script that needs prices.
// ============================================================

const fs = require("fs");

const PRICING_FILE = "relic-pricing.json";

const TIER_INTERVALS = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
};

const CATEGORY_FILE = "categories.json";

// Turns "Akbolto Prime Receiver" into "akbolto_prime_receiver"
function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Gets the lowest online sell price for one item. Returns null if none found.
async function getLowestPrice(itemName) {
  const slug = toSlug(itemName);
  try {
    const r = await fetch("https://api.warframe.market/v2/orders/item/" + slug);
    const json = await r.json();
    const sells = json.data.filter(o => o.type === "sell" && o.user.status !== "offline");
    if (sells.length === 0) return null;
    return Math.min(...sells.map(o => o.platinum));
  } catch (e) {
    return null;
  }
}

// Decides how often a relic should be price-checked, based on its value.
function assignTier(relicValue) {
  if (relicValue > 10) return "hourly";
  if (relicValue > 7) return "daily";
  return "weekly";
}

function loadPricingTable() {
  try {
    return JSON.parse(fs.readFileSync(PRICING_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function savePricingTable(table) {
  fs.writeFileSync(PRICING_FILE, JSON.stringify(table, null, 2));
}

function isRelicDue(table, relicName) {
  const entry = table[relicName];
  if (!entry) return true;

  const interval = TIER_INTERVALS[entry.tier] || TIER_INTERVALS.daily;
  const lastChecked = new Date(entry.lastChecked).getTime();
  const now = Date.now();

  return (now - lastChecked) >= interval;
}

function recordRelicPricing(table, relicName, relicValue) {
  table[relicName] = {
    tier: assignTier(relicValue),
    lastChecked: new Date().toISOString(),
    relicValue: relicValue
  };
}

function loadCategoryConfig() {
  try {
    return JSON.parse(fs.readFileSync(CATEGORY_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveCategoryConfig(config) {
  fs.writeFileSync(CATEGORY_FILE, JSON.stringify(config, null, 2));
}

function isInventoryCheckDue(config, categoryName) {
  const entry = config[categoryName]?.inventoryCheck;
  if (!entry || !entry.lastChecked) return true;

  const interval = TIER_INTERVALS[entry.tier] || TIER_INTERVALS.daily;
  const lastChecked = new Date(entry.lastChecked).getTime();
  const now = Date.now();

  return (now - lastChecked) >= interval;
}

function recordInventoryCheck(config, categoryName) {
  if (!config[categoryName]) config[categoryName] = {};
  if (!config[categoryName].inventoryCheck) config[categoryName].inventoryCheck = { tier: "daily" };
  config[categoryName].inventoryCheck.lastChecked = new Date().toISOString();
}

// Fetches prices, sorts by price, then does best-of-4 order-statistic math
async function calcRelicValue(rewardsRadiant) {
  const items = [];
  for (const x of rewardsRadiant) {
    const price = await getLowestPrice(x.itemName);
    items.push({ ...x, price: price === null ? 0 : price, priceKnown: price !== null });
  }

  items.sort((a, b) => a.price - b.price);

  let running = 0;
  let prevPow = 0;
  let relicValue = 0;
  for (const it of items) {
    running += it.chance / 100;
    const pow = Math.pow(running, 4);
    it.weight = pow - prevPow;
    prevPow = pow;
    relicValue += it.price * it.weight;
  }
  return { items, relicValue };
}

module.exports = {
  toSlug,
  getLowestPrice,
  calcRelicValue,
  assignTier,
  loadPricingTable,
  savePricingTable,
  isRelicDue,
  recordRelicPricing,
  loadCategoryConfig,
  saveCategoryConfig,
  isInventoryCheckDue,
  recordInventoryCheck
};