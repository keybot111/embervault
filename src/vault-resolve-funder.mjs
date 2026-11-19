// Vault creation, step 3a (funder): append this account's output resolutions
// (the funderKey public key operation the vault script needs).
import { openEngine, invitationIO } from "./accounts.mjs";
import { readFileSync } from "node:fs";

const TAG = process.env.VAULT_TAG || "A";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const invitation = await invitationIO.read(`exchange/vault-${TAG}-invitation.json`);

const { engine } = await openEngine("funder");
const ember = await engine.importTemplate(emberTemplate);
const updated = await engine.updateInvitation(invitation);
const invId = updated.invitation.invitationIdentifier;
const res = await engine.listOutputResolutions(invId, "vaultOutput", "funder");
console.log("funder resolutions:", JSON.stringify(res).slice(0, 300));
const after = await engine.appendOwnOutputResolutions(invId, "vaultOutput", "funder");
await invitationIO.write(`exchange/vault-${TAG}-invitation.json`, after.invitation);
console.log("funder resolutions appended + saved");
await engine.stop();
process.exit(0);
