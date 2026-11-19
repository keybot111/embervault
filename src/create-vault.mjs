// Stage 2: create Vault A (400_000 sats) from the EmberVault funder wallet.
// Secret: ember-harvest-2026. Refund height: tip + 5 (claim comes first).
import { openEngine } from "./account.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { hexToBin } from "@bitauth/libauth";
import { execFileSync } from "node:child_process";

const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const tip = Number(execFileSync("node", ["src/tip-height.mjs"], { env: { ...process.env, NODE_OPTIONS: "--use-system-ca" }, encoding: "utf8" }).trim().split("\n").pop());
console.log("chipnet tip:", tip);

const { engine } = await openEngine();
// Release reservations held by earlier abandoned invitations.
for (const inv of await engine.listInvitations()) {
  try { await engine.archiveInvitation(inv.invitation.invitationIdentifier); console.log("archived stale invitation", inv.invitation.invitationIdentifier); } catch {}
}
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
await new Promise((r) => setTimeout(r, 3000));
const spendable = await engine.listSpendableUnspentOutputs();
console.log("spendable:", spendable.map((o) => `${o.valueSatoshis} sats @ ${String(o.outpointTransactionHash).slice(0, 12)}…`));
const walletUtxo = spendable.find((o) => BigInt(o.valueSatoshis) >= 450000n);
if (!walletUtxo) { console.log("NO WALLET UTXO >= 450000"); await engine.stop(); process.exit(3); }

const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(ember.templateIdentifier);
const walletLs = getTemplateLockingScriptOrThrow(template, "funderWalletLockingScript");
const intent = walletLs.roles.funder.actions.find((a) => a.action === "createVault");
console.log("intent found:", !!intent);

const VAULT_SATS = 400000n;
const SECRET = "ember-harvest-2026";
const REFUND = tip + 5;
const created = await engine.createInvitation({
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "createVault",
  intent,
  variables: [
    { variableIdentifier: "vaultSatoshis", roleIdentifier: "funder", value: VAULT_SATS },
    { variableIdentifier: "vaultSecret", roleIdentifier: "funder", value: SECRET },
    { variableIdentifier: "refundHeight", roleIdentifier: "funder", value: REFUND },
  ],
  inputs: [{ outpointTransactionHash: hexToBin(walletUtxo.outpointTransactionHash), outpointIndex: walletUtxo.outpointIndex }],
});
const invId = created.invitation.invitationIdentifier;
console.log("invitation:", invId);
let missing = await engine.listMissingRequirements(invId);
console.log("missing after create:", JSON.stringify(missing).slice(0, 400));

// Beneficiary joins (same account, second role).
await engine.joinInvitationRole(invId, "beneficiary");
missing = await engine.listMissingRequirements(invId);
console.log("missing after beneficiary join:", JSON.stringify(missing).slice(0, 400));

await engine.appendInvitation(invId, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "createVault",
  outputs: [{ outputIdentifier: "vaultOutput" }],
});
missing = await engine.listMissingRequirements(invId);
console.log("missing after output:", JSON.stringify(missing).slice(0, 400));

const leftover = BigInt(walletUtxo.valueSatoshis) - VAULT_SATS;
if (leftover > 546n) {
  await engine.addChangeToInvitation(invId, { templateIdentifier: ember.templateIdentifier, actionIdentifier: "createVault" });
  console.log("change added");
}
const indexes = await engine.listOwnInputIndexes(invId);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: true });
const ser = result.builtTransaction?.serializedTransaction;
const txid = result.builtTransaction?.transactionHash;
console.log("EXECUTED createVault. txid:", txid);
mkdirSync("artifacts", { recursive: true });
const stored = await engine.getInvitation ? await engine.getInvitation(invId) : created;
writeFileSync("artifacts/vault-a-create-invitation.json", JSON.stringify({ invitation: created.invitation, txid, vaultSatoshis: VAULT_SATS.toString(), secret: SECRET, refundHeight: REFUND }, null, 2));
console.log("saved artifacts/vault-a-create-invitation.json");
await engine.stop();
process.exit(0);
