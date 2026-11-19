import { readFileSync } from "node:fs";
import {
  hexToBin, binToHex, decodeTransaction, hash160, sha256,
  generateSigningSerializationBch, verifySchnorr, SigningSerializationFlag,
} from "@bitauth/libauth";
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/claim-built.json", import.meta.url), "utf8"));
const tx = decodeTransaction(hexToBin(serializedTransaction));
const ub = tx.inputs[0].unlockingBytecode;
// first push = signature
const sigLen = ub[0];
const sigWithType = ub.slice(1, 1 + sigLen);
const sig = sigWithType.slice(0, 64);
const sighashByte = sigWithType[64];
console.log("sighash byte:", sighashByte.toString(16));
// redeem = last push
const redeemStart = 1 + sigLen + 1 + ub[1 + sigLen] + 1; // sig push + secret push + OP_1
// simpler: redeem is after the 0x51 byte; find push opcode 0x6a at fixed offset:
let off = 1 + sigLen; // at secret push opcode
off += 1 + ub[off]; // skip secret
off += 1; // OP_1
const redeemLen = ub[off];
const redeem = ub.slice(off + 1, off + 1 + redeemLen);
const beneficiaryPubkey = redeem.slice(redeem.indexOf(0x21) + 1, redeem.indexOf(0x21) + 34);
console.log("beneficiary pubkey:", binToHex(beneficiaryPubkey));
const sourceOutput = {
  lockingBytecode: Uint8Array.from(Buffer.from("a914" + binToHex(hash160(redeem)) + "87", "hex")),
  valueSatoshis: 20000n,
};
const preimage = generateSigningSerializationBch({
  transaction: tx,
  sourceOutputs: [sourceOutput],
  inputIndex: 0,
  coveredBytecode: redeem,
  sighash: SigningSerializationFlag.allOutputs,
});
const digest = sha256.hash(sha256.hash(preimage));
console.log("sighash digest:", binToHex(digest));
const ok = verifySchnorr(sig, beneficiaryPubkey, digest);
console.log("SCHNORR VERIFY:", ok);
