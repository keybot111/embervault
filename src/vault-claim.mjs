// Vault claim (beneficiary): reveal the secret + sign, sweeping the vault to
// the beneficiary wallet. Follow-up action demo for Vault A.
import { openEngine, jsonIO, invitationIO } from "./accounts.mjs";
import { readFileSync, mkdirSync } from "node:fs";
import { hexToBin } from "@bitauth/libauth";

const TAG = process.env.VAULT_TAG || "A";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const params = jsonIO.read(`exchange/vault-${TAG}-params.json`);
const finalInvitation = await invitationIO.read(`exchange/vault-${TAG}-invitation.json`);

const { engine } = await openEngine("beneficiary");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
await engine.updateInvitation(finalInvitation);
await new Promise((r) => setTimeout(r, 4000));
const all = await engine.listUnspentOutputs();
console.log("beneficiary unspent:", all.map((o) => `${o.valueSatoshis} sats tpl=${String(o.templateIdentifier).slice(0, 8)}`));
const vaultUtxo = all.find(
  (o) => o.templateIdentifier === ember.templateIdentifier && BigInt(o.valueSatoshis) === BigInt(params.vaultSatoshis)
);
if (!vaultUtxo) { console.log("VAULT UTXO NOT FOUND"); await engine.stop(); process.exit(3); }
console.log("vault utxo:", String(vaultUtxo.outpointTransactionHash).slice(0, 16), "idx", vaultUtxo.outpointIndex);

const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(ember.templateIdentifier);
const vaultLs = getTemplateLockingScriptOrThrow(template, "vaultLockingScript");
const intent = vaultLs.roles.beneficiary.actions.find((a) => a.action === "claimVault");
const CLAIM = BigInt(params.vaultSatoshis) - 1000n;
const created = await engine.createInvitation({
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "claimVault",
  intent,
  variables: [
    { variableIdentifier: "claimedSatoshis", roleIdentifier: "beneficiary", value: CLAIM },
    { variableIdentifier: "vaultSecret", roleIdentifier: "beneficiary", value: params.secret },
  ],
  inputs: [{
    outpointTransactionHash: hexToBin(vaultUtxo.outpointTransactionHash),
    outpointIndex: vaultUtxo.outpointIndex,
    inputIdentifier: "claimVaultInput",
  }],
});
const invId = created.invitation.invitationIdentifier;
console.log("claim invitation:", invId);
await engine.appendInvitation(invId, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "claimVault",
  outputs: [{ outputIdentifier: "claimPayoutOutput" }],
});
const missing = await engine.listMissingRequirements(invId);
console.log("missing:", JSON.stringify(missing).slice(0, 300));
const indexes = await engine.listOwnInputIndexes(invId);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: true });
const txid = result.builtTransaction?.transactionHash;
console.log("EXECUTED claimVault", TAG, "txid:", txid);
const stored = await engine.getInvitation(invId);
mkdirSync("artifacts", { recursive: true });
await invitationIO.write(`artifacts/vault-${TAG}-claim-invitation.json`, stored.invitation);
jsonIO.write(`artifacts/vault-${TAG}-claim-summary.json`, { tag: TAG, claimTxid: txid, claimedSatoshis: CLAIM.toString() });
await engine.stop();
process.exit(0);
