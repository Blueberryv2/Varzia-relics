// ============================================================
// run-checks.js
// The "heartbeat" script. Checks categories.json to see which
// categories are due for an inventory check, and only runs
// the corresponding update script for those that are due.
// Run with: node run-checks.js
// ============================================================

const { loadCategoryConfig, saveCategoryConfig, isInventoryCheckDue, recordInventoryCheck } = require("./price-utils.js");
const varziaRelics = require("./update-varzia-relics.js");
const newestRelics = require("./update-newest-relics.js");

async function main() {
  const config = loadCategoryConfig();

  if (isInventoryCheckDue(config, "varzia")) {
    console.log("=== Varzia check is due ===");
    await varziaRelics.main();
    recordInventoryCheck(config, "varzia");
  } else {
    console.log("Varzia check not due yet, skipping.");
  }

  if (isInventoryCheckDue(config, "newest")) {
    console.log("=== Newest-set check is due ===");
    await newestRelics.main();
    recordInventoryCheck(config, "newest");
  } else {
    console.log("Newest-set check not due yet, skipping.");
  }

  saveCategoryConfig(config);
  console.log("Done.");
}

main().catch(e => console.error("Failed:", e));