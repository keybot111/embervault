// Vault creation, step 2 of 3 (beneficiary): accept the invitation and take
// the beneficiary role (contributes the beneficiary key to the vault).
import { openEngine, jsonIO, invitationIO, ownPublicKeyHex } from "./accounts.mjs";
import { readFileSync } from "node:fs";

const TAG = process.env.VAULT_TAG || "A";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const invitation = await invitationIO.read(`exchange/vault-${TAG}-invitation.json`);

const { engine } = await openEngine("beneficiary");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
const accepted = await engine.acceptInvitation(invitation, { roleIdentifier: "beneficiary" });
console.log("accepted as beneficiary. commits:", accepted.invitation.commits.length);
// The accept commit generated this account's beneficiaryKey; share its public
// key as the beneficiaryPublicKey variable in a follow-up commit.
const beneficiaryPublicKey = await ownPublicKeyHex(engine, ember.templateIdentifier, "beneficiaryKey");
const withPubkey = await engine.appendInvitation(accepted.invitation.invitationIdentifier, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "createVault",
  variables: [{ variableIdentifier: "beneficiaryPublicKey", roleIdentifier: "beneficiary", value: beneficiaryPublicKey }],
});
console.log("beneficiaryPublicKey appended:", beneficiaryPublicKey);
const missing = await engine.listMissingRequirements(accepted.invitation.invitationIdentifier);
console.log("missing after accept:", JSON.stringify(missing).slice(0, 300));
await invitationIO.write(`exchange/vault-${TAG}-invitation.json`, withPubkey.invitation);
console.log("saved updated invitation");
await engine.stop();
process.exit(0);
