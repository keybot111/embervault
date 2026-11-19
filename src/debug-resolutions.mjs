import { openEngine } from "./accounts.mjs";
import { readFileSync } from "node:fs";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine("funder");
await engine.importTemplate(emberTemplate);
const invs = await engine.listInvitations();
const inv = invs[invs.length - 1];
const id = inv.invitation.invitationIdentifier;
console.log("invitation:", id, "action:", inv.invitation.actionIdentifier);
for (const role of [undefined, "funder", "beneficiary"]) {
  try {
    const res = await engine.listOutputResolutions(id, "vaultOutput", role);
    console.log("role", role ?? "(none)", "=>", JSON.stringify(res, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 500));
  } catch (e) { console.log("role", role ?? "(none)", "ERROR:", (e?.message || String(e)).slice(0, 200)); }
}
await engine.stop();
process.exit(0);
