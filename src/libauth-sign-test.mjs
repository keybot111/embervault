import {
  createCompilerBch, utf8ToBin, binToHex, hexToBin, hash160, hash256,
  decodeTransaction, encodeTransaction, createVirtualMachineBch, instantiateSecp256k1,
} from "@bitauth/libauth";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const secp = await instantiateSecp256k1();
const t = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const variables = {};
for (const [k, v] of Object.entries(t.variables)) variables[k] = { ...v, type: v.type === "private_key" ? "Key" : "WalletData" };

const beneficiaryPriv = new Uint8Array(randomBytes(32));
const beneficiaryPub = secp.derivePublicKeyCompressed(beneficiaryPriv);
const funderPub = secp.derivePublicKeyCompressed(new Uint8Array(randomBytes(32)));
const bytecodeVars = {
  vaultSecret: utf8ToBin("ember-harvest-2026"),
  refundHeight: 335622,
  beneficiaryPublicKey: beneficiaryPub,
  funderPublicKey: funderPub,
};
const compiler = createCompilerBch({
  scripts: t.scripts,
  variables,
  lockingScriptTypes: { vaultLockingBytecode: "standard" },
  unlockingScripts: { unlockClaim: "vaultLockingBytecode", unlockRefund: "vaultLockingBytecode" },
});
// 1) compile the vault locking bytecode
const lockingResult = compiler.generateBytecode({ data: { bytecode: bytecodeVars }, scriptId: "vaultLockingBytecode" });
console.log("locking compile:", lockingResult.success, lockingResult.success ? binToHex(lockingResult.bytecode) : lockingResult.errors?.[0]?.error);
const locking = lockingResult.bytecode;
// 2) build the spending tx (unlocking placeholder empty)
const spendingTx = {
  version: 2,
  locktime: 0,
  inputs: [{ outpointTransactionHash: hash256(utf8ToBin("fake-prev")), outpointIndex: 0, sequenceNumber: 0, unlockingBytecode: new Uint8Array() }],
  outputs: [{ lockingBytecode: hexToBin("76a914" + binToHex(hash160(beneficiaryPub)) + "88ac"), valueSatoshis: 19000n }],
};
const sourceOutputs = [{ lockingBytecode: locking, valueSatoshis: 20000n }];
// 3) compile the unlocking script with the transaction context
const unlockResult = compiler.generateBytecode({
  data: {
    keys: { privateKeys: { beneficiaryKey: beneficiaryPriv } },
    bytecode: bytecodeVars,
    compilationContext: { inputIndex: 0, sourceOutputs, transaction: spendingTx },
  },
  scriptId: "unlockClaim",
  debug: true,
});
console.log("unlock compile:", unlockResult.success, unlockResult.success ? "len " + unlockResult.bytecode.length : JSON.stringify(unlockResult.errors?.[0])?.slice(0, 200));
if (unlockResult.success) {
  spendingTx.inputs[0].unlockingBytecode = unlockResult.bytecode;
  const vm = createVirtualMachineBch();
  const verdict = vm.verify({ inputIndex: 0, sourceOutputs, transaction: spendingTx });
  console.log("VM verdict:", typeof verdict === "string" ? verdict : "SUCCESS (object)");
}
