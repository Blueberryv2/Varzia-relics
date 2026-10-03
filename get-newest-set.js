// ============================================================
// test-newest-relics.js
// Finds the newest Prime Warframe(s) and their companion
// weapons from the Warframe Wiki, then fetches each one's
// relic drop table.
// Standalone test, nothing touches the real site.
// ============================================================

const NUMBER_OF_WARFRAMES_TO_GET = 1;

async function getNewestSet() {
  const url = "https://wiki.warframe.com/api.php?action=parse&page=Prime_Vault&prop=wikitext&section=1&format=json";
  const r = await fetch(url);
  const json = await r.json();
  const wikitext = json.parse.wikitext["*"];

  const startMarker = "|-|Not Yet Vaulted=";
  const endMarker = "|-|Never Vaulted=";
  const section = wikitext.slice(wikitext.indexOf(startMarker), wikitext.indexOf(endMarker));

  const rowRegex = /data-rowid="([^"]+)"\s*\n\|\{\{(?:WF|Weapon)\|([^}]+)\}\}\s*\n\|(\d{4}-\d{2}-\d{2})\s*\n\|([^\n|]+)/g;
  const items = [];
  let match;
  while ((match = rowRegex.exec(section)) !== null) {
    items.push({ name: match[2].trim(), date: match[3], type: match[4].trim() });
  }

  const warframes = items
    .filter(i => i.type === "Warframe")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, NUMBER_OF_WARFRAMES_TO_GET);

  const targetDates = new Set(warframes.map(w => w.date));
  const weapons = items.filter(i => i.type.startsWith("Weapon") && targetDates.has(i.date));

  return [...warframes, ...weapons];
}

// Finds the section number for a heading named "Acquisition" on a given page
async function findAcquisitionSection(pageName) {
  const url = "https://wiki.warframe.com/api.php?action=parse&page=" + encodeURIComponent(pageName) + "&prop=sections&format=json";
  const r = await fetch(url);
  const json = await r.json();
  const match = json.parse.sections.find(s => s.line === "Acquisition");
  return match ? match.index : null;
}

// Fetches an item's Acquisition section as rendered HTML and pulls out relic names
async function getRelicsForItem(item) {
  const pageName = item.type === "Warframe"
    ? item.name.replace(" Prime", "/Prime")
    : item.name;

  const sectionIndex = await findAcquisitionSection(pageName);
  if (sectionIndex === null) {
    console.log("  Could not find an Acquisition section for " + pageName);
    return [];
  }

  const url = "https://wiki.warframe.com/api.php?action=parse&page=" + encodeURIComponent(pageName) + "&prop=text&section=" + sectionIndex + "&format=json";
  const r = await fetch(url);
  const json = await r.json();
  const html = json.parse.text["*"];

  // Relic links look like: <a href="/w/Neo_Y2" title="Neo Y2">
  const relicRegex = /title="((?:Lith|Meso|Neo|Axi) [A-Z]\d+)"/g;
  const found = new Set();
  let match;
  while ((match = relicRegex.exec(html)) !== null) {
    found.add(match[1]);
  }
  return [...found];
}

async function main() {
  console.log("Finding the newest set...");
  const setItems = await getNewestSet();
  console.log("Set: " + setItems.map(i => i.name).join(", "));

  console.log("\nFetching relics for each item...");
  for (const item of setItems) {
    const relics = await getRelicsForItem(item);
    console.log("\n" + item.name + ":");
    relics.forEach(r => console.log("  " + r));
  }
}

// Only run main() when this file is executed directly (node get-newest-set.js),
// not when another file imports it.
if (require.main === module) {
  main().catch(e => console.error("Failed:", e));
}

module.exports = { getNewestSet, getRelicsForItem };