import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("valuation workspace catches up confirmed ordinary outflows before monetary reports", async () => {
  const [composition, liveService] = await Promise.all([
    read("src/composition/inventory/create-inventory-valuation-workspace-services.ts"),
    readFile(
      new URL(
        "../../../packages/inventory-tauri/src/sqlite-inventory-valuation-live-service.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(composition, /SqliteInventoryValuationLiveService/u);
  assert.match(composition, /await catchUp\(query\.companyId\)/u);
  assert.match(composition, /return reports\.readAsOf/u);
  assert.match(composition, /return reports\.readMonetaryKardex/u);
  assert.match(composition, /return reports\.readLayers/u);

  assert.match(liveService, /e\.valuation_entry_id IS NULL/u);
  assert.match(liveService, /m\.transfer_id IS NULL/u);
  assert.match(liveService, /m\.reversal_of_movement_id IS NULL/u);
  assert.match(liveService, /fifoInventoryValuationStrategy\.issue/u);
  assert.match(liveService, /movingAverageInventoryValuationStrategy\.issue/u);
  assert.match(liveService, /inventory_valuation_entries/u);
  assert.match(liveService, /inventory_valuation_cost_layers/u);
  assert.match(liveService, /inventory_valuation_states/u);
  assert.match(liveService, /inventory_valuation_stream_versions/u);
});

test("live catch-up refuses to guess through already-valued later chronology", async () => {
  const liveService = await readFile(
    new URL(
      "../../../packages/inventory-tauri/src/sqlite-inventory-valuation-live-service.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(liveService, /const laterEntry/u);
  assert.match(liveService, /blockedMovementCount \+= 1/u);
});

test("monetary kardex date filters reserve readable width and calendar-icon space", async () => {
  const css = await read("src/pages/inventory/inventory-valuation-workspace-page.css");
  assert.match(css, /repeat\(2, minmax\(180px, \.8fr\)\)/u);
  assert.match(css, /padding: 0 12px 0 42px/u);
  assert.match(css, /text-align: center/u);
  assert.match(css, /white-space: nowrap/u);
});
