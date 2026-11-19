import { readFileSync } from "node:fs";
import {
  hexToBin, binToHex, decodeTransaction, createVirtualMachineBch,
  encodeDataPush, hash160, utf8ToBin, createCompilerBch,
} from "@bitauth/libauth";

const rawHex = readFileSync("/tmp/claim-tx.hex", "utf8").trim();
const tx = decodeTransaction(hexToBin(rawHex));
console.log("version:", tx.version, "locktime:", tx.locktime, "inputs:", tx.inputs.length, "outputs:", tx.outputs.length);
const inp = tx.inputs[0];
console.log("input0 seq:", inp.sequenceNumber, "unlock len:", inp.unlockingBytecode.length);
console.log("unlock hex:", binToHex(inp.unlockingBytecode));

// Parse pushes of the unlocking bytecode manually
let i = 0; const pushes = [];
const ub = inp.unlockingBytecode;
while (i < ub.length) {
  const op = ub[i];
  if (op >= 0x01 && op <= 0x4b) { pushes.push(ub.slice(i + 1, i + 1 + op)); i += 1 + op; }
  else if (op === 0x4c) { const l = ub[i + 1]; pushes.push(ub.slice(i + 2, i + 2 + l)); i += 2 + l; }
  else if (op === 0x4d) { const l = ub[i + 1] | (ub[i + 2] << 8); pushes.push(ub.slice(i + 3, i + 3 + l)); i += 3 + l; }
  else { pushes.push(Uint8Array.of(op)); i += 1; }
}
console.log("pushes:", pushes.map((p) => p.length + "B"));
const redeem = pushes[pushes.length - 1];
console.log("redeem len:", redeem.length, "hex:", binToHex(redeem));
console.log("secret push:", JSON.stringify(Buffer.from(pushes[1]).toString("utf8")));
console.log("redeem hash160:", binToHex(hash160(redeem)));

// Source output locking bytecode (from create tx 28b94950 output 0)
console.log("expected vault locking: 76a914...? no — P2SH: a914" + binToHex(hash160(redeem)) + "87");

// Run the VM: unlocking + locking (P2SH)
const vm = createVirtualMachineBch();
const locking = Uint8Array.from(Buffer.from("a914" + binToHex(hash160(redeem)) + "87", "hex"));
const program = vm.createProgram({
  instructions: [], // not used this way in libauth 3? fallback below
});
