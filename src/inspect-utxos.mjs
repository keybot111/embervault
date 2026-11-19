import { openEngine } from "./accounts.mjs";
const { engine } = await openEngine("funder");
const all = await engine.listUnspentOutputs();
for (const o of all) {
  console.log(`${o.valueSatoshis} sats | status=${o.status} | reservedBy=${o.reservedBy ?? "-"} | tx=${String(o.outpointTransactionHash).slice(0, 16)}… idx=${o.outpointIndex} | tpl=${String(o.templateIdentifier).slice(0, 8)}`);
}
console.log("total:", all.length);
await engine.stop();
process.exit(0);
