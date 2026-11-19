import { openEngine, invitationIO } from "./accounts.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const { engine } = await openEngine("beneficiary");
const invs = await engine.listInvitations();
for (const inv of invs) {
  const i = inv.invitation;
  if (i.actionIdentifier !== "claimVault") continue;
  console.log("claim invitation:", i.invitationIdentifier, "result:", JSON.stringify(i.result)?.slice(0, 200));
  const ser = JSON.stringify(i, (k, v) => (v instanceof Uint8Array ? { $bin: Buffer.from(v).toString("hex") } : typeof v === "bigint" ? v.toString() : v));
  writeFileSync("/tmp/claim-invitation-dump.json", ser);
  console.log("dumped", ser.length, "bytes; keys:", Object.keys(i));
  for (const c of i.commits ?? []) {
    console.log("commit keys:", Object.keys(c.data ?? {}), "result in data?", JSON.stringify(c.data?.result)?.slice(0, 120));
  }
}
await engine.stop();
process.exit(0);
