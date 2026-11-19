// Fund the v2 EmberVault funder wallet from the p2pkh wallet's remaining
// balance (the stage-1 change). Prints the v2 receive address first.
import { openEngine } from "./accounts.mjs";
import { p2pkhTemplate } from "@xo-cash/templates";
import { readFileSync } from "node:fs";
import { hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";

const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine("funder");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
const emberReceiveLb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
const emberAddr = lockingBytecodeToCashAddress({ bytecode: hexToBin(emberReceiveLb), prefix: "bchtest" });
console.log("V2 RECEIVE ADDRESS:", typeof emberAddr === "string" ? emberAddr : emberAddr.address);

const p2pkh = await engine.importTemplate(p2pkhTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: p2pkh.templateIdentifier },
  receive: { templateIdentifier: p2pkh.templateIdentifier },
  address: { templateIdentifier: p2pkh.templateIdentifier },
});
await new Promise((r) => setTimeout(r, 3000));
const spendable = await engine.listSpendableUnspentOutputs();
const mine = spendable.filter((o) => o.templateIdentifier === p2pkh.templateIdentifier);
console.log("p2pkh spendable:", mine.map((o) => o.valueSatoshis));
const funded = mine.find((o) => BigInt(o.valueSatoshis) >= 20000n);
if (!funded) { console.log("NO P2PKH FUNDS TO MOVE"); await engine.stop(); process.exit(0); }
const SEND = BigInt(funded.valueSatoshis) - 1500n;
const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(p2pkh.templateIdentifier);
const ls = getTemplateLockingScriptOrThrow(template, "receivingLockingScript");
const intent = ls.roles.receiver.actions.find((a) => a.action === "sendSatoshis");
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
await engine.appendInvitation(invId, {
  templateIdentifier: p2pkh.templateIdentifier,
  actionIdentifier: "sendSatoshis",
  outputs: [{ outputIdentifier: "transferSatoshisOutput" }],
});
const indexes = await engine.listOwnInputIndexes(invId);
for (const i of indexes) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: true });
console.log("MOVED", SEND.toString(), "sats to v2 wallet. txid:", result.builtTransaction?.transactionHash);
await engine.stop();
process.exit(0);
