// Stage 1: move 900_000 sats from the account's p2pkh wallet (faucet-funded)
// into the EmberVault template's funder wallet, using p2pkh sendSatoshis.
import { openEngine } from "./account.mjs";
import { p2pkhTemplate } from "@xo-cash/templates";
import { readFileSync } from "node:fs";
import { hexToBin, binToHex, lockingBytecodeToCashAddress } from "@bitauth/libauth";

const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine();

// 1. EmberVault template: generate the funder-wallet receive bytecode first.
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
const emberReceiveLb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
const emberAddr = lockingBytecodeToCashAddress({ bytecode: hexToBin(emberReceiveLb), prefix: "bchtest" });
console.log("EmberVault funder wallet:", typeof emberAddr === "string" ? emberAddr : emberAddr.address);

// 2. Switch defaults to p2pkh and find the faucet UTXO.
const p2pkh = await engine.importTemplate(p2pkhTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: p2pkh.templateIdentifier },
  receive: { templateIdentifier: p2pkh.templateIdentifier },
  address: { templateIdentifier: p2pkh.templateIdentifier },
});
await new Promise((r) => setTimeout(r, 3000));
const spendable = await engine.listSpendableUnspentOutputs();
console.log("spendable outputs:", spendable.map((o) => `${o.valueSatoshis} sats`));
const funded = spendable.find((o) => BigInt(o.valueSatoshis) >= 950000n);
if (!funded) { console.log("FAUCET UTXO NOT VISIBLE YET"); await engine.stop(); process.exit(3); }

// 3. sendSatoshis intent from the p2pkh receiving locking script.
const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(p2pkh.templateIdentifier);
const ls = getTemplateLockingScriptOrThrow(template, "receivingLockingScript");
const intent = ls.roles.receiver.actions.find((a) => a.action === "sendSatoshis");
const SEND = 900000n;
const created = await engine.createInvitation({
  templateIdentifier: p2pkh.templateIdentifier,
  actionIdentifier: "sendSatoshis",
  intent,
  variables: [
    { variableIdentifier: "transferredSatoshis", roleIdentifier: "sender", value: SEND },
    { variableIdentifier: "recipientLockingscript", roleIdentifier: "sender", value: emberReceiveLb },
  ],
  inputs: [{ outpointTransactionHash: hexToBin(funded.outpointTransactionHash), outpointIndex: funded.outpointIndex }],
});
const invId = created.invitation.invitationIdentifier;
console.log("invitation:", invId);
await engine.appendInvitation(invId, {
  templateIdentifier: p2pkh.templateIdentifier,
  actionIdentifier: "sendSatoshis",
  outputs: [{ outputIdentifier: "transferSatoshisOutput" }],
});
const missing = await engine.listMissingRequirements(invId);
console.log("missing:", JSON.stringify(missing).slice(0, 300));
const DUST = 546n;
const leftover = BigInt(funded.valueSatoshis) - SEND;
if (leftover > DUST) {
  await engine.addChangeToInvitation(invId, { templateIdentifier: p2pkh.templateIdentifier, actionIdentifier: "sendSatoshis" });
  console.log("change added");
}
const indexes = await engine.listOwnInputIndexes(invId);
console.log("own input indexes:", indexes);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: true });
console.log("EXECUTED:", JSON.stringify(result, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 400));
await engine.stop();
process.exit(0);
