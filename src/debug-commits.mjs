import { openEngine } from "./accounts.mjs";
import { readFileSync } from "node:fs";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine("funder");
await engine.importTemplate(emberTemplate);
const invs = await engine.listInvitations();
const inv = invs[invs.length - 1].invitation;
for (const c of inv.commits) {
  console.log("commit", c.commitIdentifier.slice(0, 8), "data keys:", Object.keys(c.data));
  console.log("  ", JSON.stringify(c.data, (k, v) => typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? `bytes(${v.length})` : v).slice(0, 600));
}
await engine.stop();
process.exit(0);
