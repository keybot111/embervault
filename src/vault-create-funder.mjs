// Vault creation, step 1 of 3 (funder): start the createVault invitation.
// Env: VAULT_TAG (A|B), VAULT_SATS, VAULT_SECRET, REFUND_OFFSET (blocks)
import { openEngine, jsonIO, invitationIO, ownPublicKeyHex } from "./accounts.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { hexToBin } from "@bitauth/libauth";
import { execFileSync } from "node:child_process";

const TAG = process.env.VAULT_TAG || "A";
const SATS = BigInt(process.env.VAULT_SATS || "400000");
const SECRET = process.env.VAULT_SECRET || "ember-harvest-2026";
const OFFSET = Number(process.env.REFUND_OFFSET || "5");

const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const tip = Number(execFileSync("node", ["src/tip-height.mjs"], { encoding: "utf8" }).trim().split("\n").pop());
const REFUND = tip + OFFSET;
console.log(`vault ${TAG}: tip=${tip} refundHeight=${REFUND} sats=${SATS}`);

const { engine } = await openEngine("funder");
for (const inv of await engine.listInvitations()) {
  try { await engine.archiveInvitation(inv.invitation.invitationIdentifier); } catch {}
}
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
await new Promise((r) => setTimeout(r, 3000));
const spendable = await engine.listSpendableUnspentOutputs();
const walletUtxo = spendable.find(
  (o) => o.templateIdentifier === ember.templateIdentifier && BigInt(o.valueSatoshis) >= SATS + 2000n
);
if (!walletUtxo) {
  console.log("spendable:", spendable.map((o) => o.valueSatoshis));
  console.log("NO SUITABLE WALLET UTXO");
  await engine.stop();
  process.exit(3);
}
const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(ember.templateIdentifier);
const walletLs = getTemplateLockingScriptOrThrow(template, "funderWalletLockingScript");
const intent = walletLs.roles.funder.actions.find((a) => a.action === "createVault");

const created = await engine.createInvitation({
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "createVault",
  intent,
  variables: [
    { variableIdentifier: "vaultSatoshis", roleIdentifier: "funder", value: SATS },
    { variableIdentifier: "vaultSecret", roleIdentifier: "funder", value: SECRET },
    { variableIdentifier: "refundHeight", roleIdentifier: "funder", value: REFUND },
  ],
  inputs: [{ outpointTransactionHash: hexToBin(walletUtxo.outpointTransactionHash), outpointIndex: walletUtxo.outpointIndex }],
});
// The createVault commit generated this account's funderKey; share its public
// key as the funderPublicKey variable in a follow-up commit.
const funderPublicKey = await ownPublicKeyHex(engine, ember.templateIdentifier, "funderKey");
const withPubkey = await engine.appendInvitation(created.invitation.invitationIdentifier, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "createVault",
  variables: [{ variableIdentifier: "funderPublicKey", roleIdentifier: "funder", value: funderPublicKey }],
});
console.log("funderPublicKey appended:", funderPublicKey);
mkdirSync("exchange", { recursive: true });
await invitationIO.write(`exchange/vault-${TAG}-invitation.json`, withPubkey.invitation);
jsonIO.write(`exchange/vault-${TAG}-params.json`, {
  tag: TAG, vaultSatoshis: SATS.toString(), secret: SECRET, refundHeight: REFUND,
  templateIdentifier: ember.templateIdentifier,
});
console.log("invitation created:", created.invitation.invitationIdentifier);
console.log("saved exchange/vault-" + TAG + "-invitation.json");
await engine.stop();
process.exit(0);
