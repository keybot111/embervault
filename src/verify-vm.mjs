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
const program = {
  inputIndex: 0,
  sourceOutputs: [{ lockingBytecode: locking, valueSatoshis: 20000n }],
  transaction: tx,
};
const result = vm.verify(program);
console.log("VM verify:", JSON.stringify(result)?.slice(0, 400));
