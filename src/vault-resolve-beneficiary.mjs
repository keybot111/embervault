// Vault creation, step 3b (beneficiary): append this account's output
// resolutions (the beneficiaryKey public key operation).
import { openEngine, invitationIO } from "./accounts.mjs";
import { readFileSync } from "node:fs";

const TAG = process.env.VAULT_TAG || "A";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const invitation = await invitationIO.read(`exchange/vault-${TAG}-invitation.json`);

const { engine } = await openEngine("beneficiary");
const ember = await engine.importTemplate(emberTemplate);
const updated = await engine.updateInvitation(invitation);
const invId = updated.invitation.invitationIdentifier;
const res = await engine.listOutputResolutions(invId, "vaultOutput", "beneficiary");
console.log("beneficiary resolutions:", JSON.stringify(res).slice(0, 300));
const after = await engine.appendOwnOutputResolutions(invId, "vaultOutput", "beneficiary");
await invitationIO.write(`exchange/vault-${TAG}-invitation.json`, after.invitation);
console.log("beneficiary resolutions appended + saved");
await engine.stop();
process.exit(0);
