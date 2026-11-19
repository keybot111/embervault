import { readFileSync } from "node:fs";
import { hexToBin, binToHex, decodeTransaction, hash160 } from "@bitauth/libauth";
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/claim-built.json", import.meta.url), "utf8"));
const tx = decodeTransaction(hexToBin(serializedTransaction));
const ub = tx.inputs[0].unlockingBytecode;
let i = 0; const pushes = [];
while (i < ub.length) {
  const op = ub[i];
  if (op >= 0x01 && op <= 0x4b) { pushes.push(ub.slice(i + 1, i + 1 + op)); i += 1 + op; }
  else if (op === 0x4c) { const l = ub[i + 1]; pushes.push(ub.slice(i + 2, i + 2 + l)); i += 2 + l; }
  else if (op === 0x4d) { const l = ub[i + 1] | (ub[i + 2] << 8); pushes.push(ub.slice(i + 3, i + 3 + l)); i += 3 + l; }
  else { pushes.push(Uint8Array.of(op)); i += 1; }
}
const redeem = pushes[pushes.length - 1];
console.log("redeem:", binToHex(redeem));
console.log("redeem hash160:", binToHex(hash160(redeem)));
console.log("claim input sequence:", tx.inputs[0].sequenceNumber, "locktime:", tx.locktime);
