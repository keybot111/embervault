import { readFileSync } from "node:fs";
import { hexToBin, binToHex, decodeTransaction, hash160, createVirtualMachineBch } from "@bitauth/libauth";
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/claim-built.json", import.meta.url), "utf8"));
const tx = decodeTransaction(hexToBin(serializedTransaction));
const ub = tx.inputs[0].unlockingBytecode;
const sigLen = ub[0];
let off = 1 + sigLen; off += 1 + ub[off]; off += 1;
const redeem = ub.slice(off + 1, off + 1 + ub[off]);
const locking = Uint8Array.from(Buffer.from("a914" + binToHex(hash160(redeem)) + "87", "hex"));
const vm = createVirtualMachineBch();
let state = vm.stateInitialize({
  inputIndex: 0,
  sourceOutputs: [{ lockingBytecode: locking, valueSatoshis: 20000n }],
  transaction: tx,
});
console.log("initial state keys:", Object.keys(state ?? {}));
let guard = 0;
while (state && state.error === undefined && guard++ < 500) {
  const next = vm.stateStep(state);
  if (next === undefined || next === state) break;
  state = next;
  if (vm.stateSuccess?.(state)) break;
}
console.log("final error:", state?.error);
console.log("stack:", state?.stack?.map((s) => binToHex(s)));
