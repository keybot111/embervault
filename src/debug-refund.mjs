import { openEngine, jsonIO } from "./accounts.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { hexToBin } from "@bitauth/libauth";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const params = jsonIO.read("exchange/vault-B-params.json");
const { engine } = await openEngine("funder");
const ember = await engine.importTemplate(emberTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier: ember.templateIdentifier },
  receive: { templateIdentifier: ember.templateIdentifier },
  address: { templateIdentifier: ember.templateIdentifier },
});
await new Promise((r) => setTimeout(r, 3000));
const all = await engine.listUnspentOutputs();
const vaultUtxo = all.find((o) => o.templateIdentifier === ember.templateIdentifier && BigInt(o.valueSatoshis) === BigInt(params.vaultSatoshis));
const { getTemplateLockingScriptOrThrow } = await import("@xo-cash/engine");
const template = await engine.getTemplate(ember.templateIdentifier);
const intent = getTemplateLockingScriptOrThrow(template, "vaultLockingScript").roles.funder.actions.find((a) => a.action === "refundVault");
const created = await engine.createInvitation({
  templateIdentifier: ember.templateIdentifier,
  actionIdentifier: "refundVault",
  intent,
  variables: [
    { variableIdentifier: "refundedSatoshis", roleIdentifier: "funder", value: BigInt(params.vaultSatoshis) - 1000n },
    { variableIdentifier: "refundHeight", roleIdentifier: "funder", value: params.refundHeight },
  ],
  inputs: [{ outpointTransactionHash: hexToBin(vaultUtxo.outpointTransactionHash), outpointIndex: vaultUtxo.outpointIndex, inputIdentifier: "refundVaultInput" }],
});
const invId = created.invitation.invitationIdentifier;
await engine.appendInvitation(invId, { templateIdentifier: ember.templateIdentifier, actionIdentifier: "refundVault", outputs: [{ outputIdentifier: "refundPayoutOutput" }] });
for (const i of await engine.listOwnInputIndexes(invId)) await engine.signInvitation(invId, i);
const result = await engine.executeAction(invId, { broadcastTransaction: false });
const bt = result.builtTransaction;
const dump = JSON.stringify(bt, (k, v) => (v instanceof Uint8Array ? { $bin: Buffer.from(v).toString("hex") } : typeof v === "bigint" ? v.toString() : v), 2);
writeFileSync("artifacts/refund-built.json", dump);
console.log("WROTE artifacts/refund-built.json", dump.length, "bytes; top keys:", Object.keys(bt ?? {}));
await engine.stop();
process.exit(0);
