// ============================================================
// update-relics.js
// Checks Varzia's current relics, fetches prices, does the
// best-of-4 math, and saves the result to relics.json.
// Run with: node update-relics.js
// ============================================================

const fs = require("fs");

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

async function main() {
  console.log("Checking Varzia's inventory...");
  const r = await fetch("https://api.warframestat.us/pc/vaultTrader");
  const json = await r.json();
  const relics = json.inventory.filter(i => i.uniqueName.includes("VoidProjection"));

  console.log("Loading relic name table...");
  const r2 = await fetch("https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai/ExportRelics.json");
  const table = await r2.json();

  const relicMatches = relics.map(i => {
  const key = i.uniqueName.replace("/StoreItems", "");
  const entry = table[key];
  if (!entry) return null;
  return {
    full: entry.era + " " + entry.category,
    icon: "https://cdn.warframestat.us/img/" + entry.icon.split("/").pop()
  };
  }).filter(m => m !== null);

    const results = [];
  for (const { full, icon } of relicMatches) {
    console.log("Checking " + full + "...");
    const [tier, name] = full.split(" ");
    const rr = await fetch("https://drops.warframestat.us/data/relics/" + tier + "/" + name + ".json");
    const data = await rr.json();

    const { items, relicValue } = await calcRelicValue(data.rewards.Radiant);
    results.push({ relic: full, icon: icon, relicValue: Number(relicValue.toFixed(2)), items });
  }

  results.sort((a, b) => b.relicValue - a.relicValue); // highest value first

  const output = {
    generatedAt: new Date().toISOString(),
    varziaExpiry: json.expiry,
    relics: results
  };

  fs.writeFileSync("relics.json", JSON.stringify(output, null, 2));
  console.log("Saved relics.json");
}

main().catch(e => {
  console.error("Failed:", e);
  process.exit(1);
});