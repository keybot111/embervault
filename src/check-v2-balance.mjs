import { openEngine } from "./accounts.mjs";
import { readFileSync } from "node:fs";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine("funder");
const ember = await engine.importTemplate(emberTemplate);
await new Promise((r) => setTimeout(r, 4000));
const all = await engine.listUnspentOutputs();
for (const o of all) {
  if (o.templateIdentifier === ember.templateIdentifier) {
    console.log(`v2 UTXO: ${o.valueSatoshis} sats status=${o.status} tx=${String(o.outpointTransactionHash).slice(0, 16)}…`);
  }
}
await engine.stop();
process.exit(0);
