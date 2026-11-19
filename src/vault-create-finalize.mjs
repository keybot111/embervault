// Vault creation, step 3 of 3 (funder): ingest the beneficiary's commit, add
// the vault output + change, sign and execute (broadcasts the funding tx).
import { openEngine, jsonIO, invitationIO } from "./accounts.mjs";
import { readFileSync, mkdirSync } from "node:fs";

const TAG = process.env.VAULT_TAG || "A";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const params = jsonIO.read(`exchange/vault-${TAG}-params.json`);
const invitation = await invitationIO.read(`exchange/vault-${TAG}-invitation.json`);

const { engine } = await openEngine("funder");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
const updated = await engine.updateInvitation(invitation);
const invId = updated.invitation.invitationIdentifier;
let missing = await engine.listMissingRequirements(invId);
console.log("missing after update:", JSON.stringify(missing).slice(0, 300));

await engine.appendInvitation(invId, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "createVault",
  outputs: [{ outputIdentifier: "vaultOutput" }],
});
missing = await engine.listMissingRequirements(invId);
console.log("missing after output:", JSON.stringify(missing).slice(0, 300));

await engine.addChangeToInvitation(invId, { templateIdentifier: ember.templateIdentifier, actionIdentifier: "createVault" });
const indexes = await engine.listOwnInputIndexes(invId);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: true });
const txid = result.builtTransaction?.transactionHash;
console.log("EXECUTED createVault", TAG, "txid:", txid);

const finalStored = await engine.getInvitation(invId);
mkdirSync("artifacts", { recursive: true });
await invitationIO.write(`artifacts/vault-${TAG}-create-invitation.json`, finalStored.invitation);
jsonIO.write(`artifacts/vault-${TAG}-summary.json`, { ...params, createTxid: txid, invitationIdentifier: invId });
await invitationIO.write(`exchange/vault-${TAG}-invitation.json`, finalStored.invitation);
console.log("saved artifacts + updated exchange invitation");
await engine.stop();
process.exit(0);
