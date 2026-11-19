import { openEngine, jsonIO } from "./accounts.mjs";
import { mkdirSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { hexToBin, binToHex, decodeTransaction, encodeTransaction } from "@bitauth/libauth";

const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const params = jsonIO.read("exchange/vault-A-params.json");
console.log("params:", params);
const { engine } = await openEngine("beneficiary");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
await new Promise((r) => setTimeout(r, 3000));
const all = await engine.listUnspentOutputs();
const vaultUtxo = all.find(
  (o) => o.templateIdentifier === ember.templateIdentifier && BigInt(o.valueSatoshis) === BigInt(params.vaultSatoshis)
);
console.log("vault utxo:", vaultUtxo?.outpointTransactionHash, vaultUtxo?.outpointIndex, vaultUtxo?.status);
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
await engine.appendInvitation(invId, {
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "claimVault",
  outputs: [{ outputIdentifier: "claimPayoutOutput" }],
});
const indexes = await engine.listOwnInputIndexes(invId);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: false });
const bt = result.builtTransaction;
console.log("built tx hash:", bt?.transactionHash);
console.log("builtTransaction keys:", Object.keys(bt ?? {}), "tx type:", typeof bt?.transaction); const raw = bt?.transaction;
const rawHex = typeof raw === "string" ? raw : binToHex(raw instanceof Uint8Array ? raw : encodeTransaction(raw));
writeFileSync("artifacts/claim-tx.hex", rawHex);
const tx = decodeTransaction(hexToBin(rawHex));
console.log("version:", tx.version, "locktime:", tx.locktime);
tx.inputs.forEach((inp, i) => {
  console.log(`input ${i}: seq=${inp.sequenceNumber} unlockLen=${inp.unlockingBytecode.length} unlock=${binToHex(inp.unlockingBytecode).slice(0, 120)}…`);
});
tx.outputs.forEach((o, i) => console.log(`output ${i}: ${o.valueSatoshis} sats script=${binToHex(o.lockingBytecode)}`));
await engine.stop();
process.exit(0);
