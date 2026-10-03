// ============================================================
// update-relics.js
// Checks Varzia's current relics, fetches prices, does the
// best-of-4 math, and saves the result to relics.json.
// Run with: node update-relics.js
// ============================================================

const { toSlug, getLowestPrice, calcRelicValue, loadPricingTable, savePricingTable, isRelicDue, recordRelicPricing } = require("./price-utils.js");
const fs = require("fs");

async function main() {
  console.log("Fetching current rotation from the wiki...");
  const r = await fetch("https://wiki.warframe.com/api.php?action=parse&page=Prime_Resurgence&prop=wikitext&section=1&format=json");
  const json = await r.json();
  const wikitext = json.parse.wikitext["*"];

  const blocks = wikitext.split(/\|data-sort-value="Dual /);
  let currentBlock = null;
  for (const block of blocks) {
    if (block.includes('class="posTextIcon"')) {
      currentBlock = block;
      break;
    }
  }

  if (!currentBlock) {
    console.log("Could not find the current rotation. Aborting.");
    return;
  }

  const relicRegex = /\{\{Relic\|([^}]+)\}\}/g;
  const relicNames = [];
  let match;
  while ((match = relicRegex.exec(currentBlock)) !== null) {
    relicNames.push(match[1]);
  }

  console.log("Current rotation relics: " + relicNames.join(", "));

  const relicMatches = relicNames.map(full => {
    const tier = full.split(" ")[0]; // "Lith", "Meso", "Neo", "Axi"
    return {
      full: full,
      icon: "Images/" + tier + "0.png"
    };
  });

  const pricingTable = loadPricingTable();
  const results = [];

  for (const match of relicMatches) {
    if (!isRelicDue(pricingTable, match.full)) {
      console.log(match.full + " not due yet, reusing last known price.");
      const cached = pricingTable[match.full];
      results.push({ relic: match.full, icon: match.icon, relicValue: cached.relicValue, items: cached.items || [] });
      continue;
    }

    console.log("Checking " + match.full + "...");
    const [tier, name] = match.full.split(" ");
    const rr = await fetch("https://drops.warframestat.us/data/relics/" + tier + "/" + name + ".json");
    const data = await rr.json();

    const { items, relicValue } = await calcRelicValue(data.rewards.Radiant);
    const roundedValue = Number(relicValue.toFixed(2));

    results.push({ relic: match.full, icon: match.icon, relicValue: roundedValue, items });
    recordRelicPricing(pricingTable, match.full, roundedValue);
    pricingTable[match.full].items = items;
  }

  savePricingTable(pricingTable);

  results.sort((a, b) => b.relicValue - a.relicValue); // highest value first

  const output = {
    generatedAt: new Date().toISOString(),
    varziaExpiry: json.expiry,
    relics: results
  };

  fs.writeFileSync("varzia-relics.json", JSON.stringify(output, null, 2));
  console.log("Saved varzia-relics.json");
}

if (require.main === module) {
  main().catch(e => console.error("Failed:", e));
}

module.exports = { main };