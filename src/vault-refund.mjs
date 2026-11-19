// Vault refund (funder): after the refund height, sweep the vault back to the
// funder wallet without the secret. Follow-up action demo for Vault B.
import { openEngine, jsonIO, invitationIO } from "./accounts.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { hexToBin } from "@bitauth/libauth";

const TAG = process.env.VAULT_TAG || "B";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const params = jsonIO.read(`exchange/vault-${TAG}-params.json`);
const finalInvitation = await invitationIO.read(`exchange/vault-${TAG}-invitation.json`);

const { engine } = await openEngine("funder");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
await engine.updateInvitation(finalInvitation);
await new Promise((r) => setTimeout(r, 4000));
const all = await engine.listUnspentOutputs();
const vaultUtxo = all.find(
  (o) => o.templateIdentifier === ember.templateIdentifier && BigInt(o.valueSatoshis) === BigInt(params.vaultSatoshis) && !o.reservedBy
);
if (!vaultUtxo) {
  console.log("unspent:", all.map((o) => `${o.valueSatoshis} sats reserved=${o.reservedBy ?? "-"}`));
  console.log("VAULT UTXO NOT FOUND");
  await engine.stop();
  process.exit(3);
}
console.log("vault utxo:", String(vaultUtxo.outpointTransactionHash).slice(0, 16), "idx", vaultUtxo.outpointIndex);

const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(ember.templateIdentifier);
const vaultLs = getTemplateLockingScriptOrThrow(template, "vaultLockingScript");
const intent = vaultLs.roles.funder.actions.find((a) => a.action === "refundVault");
const REFUNDED = BigInt(params.vaultSatoshis) - 1000n;
const created = await engine.createInvitation({
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "refundVault",
  intent,
  variables: [
    { variableIdentifier: "refundedSatoshis", roleIdentifier: "funder", value: REFUNDED },
    { variableIdentifier: "refundHeight", roleIdentifier: "funder", value: params.refundHeight },
  ],
  inputs: [{
    outpointTransactionHash: hexToBin(vaultUtxo.outpointTransactionHash),
    outpointIndex: vaultUtxo.outpointIndex,
    inputIdentifier: "refundVaultInput",
  }],
});
const invId = created.invitation.invitationIdentifier;
console.log("refund invitation:", invId);
await engine.appendInvitation(invId, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "refundVault",
  outputs: [{ outputIdentifier: "refundPayoutOutput" }],
});
const missing = await engine.listMissingRequirements(invId);
console.log("missing:", JSON.stringify(missing).slice(0, 300));
const indexes = await engine.listOwnInputIndexes(invId);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: true });
const txid = result.builtTransaction?.transactionHash;
console.log("EXECUTED refundVault", TAG, "txid:", txid);
const stored = await engine.getInvitation(invId);
mkdirSync("artifacts", { recursive: true });
await invitationIO.write(`artifacts/vault-${TAG}-refund-invitation.json`, stored.invitation);
jsonIO.write(`artifacts/vault-${TAG}-refund-summary.json`, { tag: TAG, refundTxid: txid, refundedSatoshis: REFUNDED.toString(), refundHeight: params.refundHeight });
await engine.stop();
process.exit(0);
