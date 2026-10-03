// ============================================================
// update-newest-relics.js
// Finds the newest Prime Warframe set, fetches each of its
// relics' contents, prices them, and saves the result to
// newest-relics.json.
// Run with: node update-newest-relics.js
// ============================================================

const fs = require("fs");
const { calcRelicValue, loadPricingTable, savePricingTable, isRelicDue, recordRelicPricing } = require("./price-utils.js");
const { getNewestSet, getRelicsForItem } = require("./get-newest-set.js");

async function main() {
  console.log("Finding the newest set...");
  const setItems = await getNewestSet();
  console.log("Set: " + setItems.map(i => i.name).join(", "));

  // Gather every relic name across all items in the set, no duplicates
  const relicNames = new Set();
  for (const item of setItems) {
    const relics = await getRelicsForItem(item);
    relics.forEach(r => relicNames.add(r));
  }
  console.log("Relics found: " + [...relicNames].join(", "));

  const pricingTable = loadPricingTable();
  const results = [];

  for (const full of relicNames) {
    if (!isRelicDue(pricingTable, full)) {
      console.log(full + " not due yet, reusing last known price.");
      const cached = pricingTable[full];
      results.push({ relic: full, relicValue: cached.relicValue, items: cached.items || [] });
      continue;
    }

    console.log("Checking " + full + "...");
    const [tier, name] = full.split(" ");
    const rr = await fetch("https://drops.warframestat.us/data/relics/" + tier + "/" + name + ".json");
    const data = await rr.json();

    const { items, relicValue } = await calcRelicValue(data.rewards.Radiant);
    const roundedValue = Number(relicValue.toFixed(2));

    results.push({ relic: full, relicValue: roundedValue, items });
    recordRelicPricing(pricingTable, full, roundedValue);
    pricingTable[full].items = items;
  }

  savePricingTable(pricingTable);

  results.sort((a, b) => b.relicValue - a.relicValue); // highest value first

  const output = {
    generatedAt: new Date().toISOString(),
    setItems: setItems.map(i => i.name),
    relics: results
  };

  fs.writeFileSync("newest-relics.json", JSON.stringify(output, null, 2));
  console.log("Saved newest-relics.json");
}

if (require.main === module) {
  main().catch(e => console.error("Failed:", e));
}

module.exports = { main };