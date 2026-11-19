import {
  createCompilerBch, utf8ToBin, binToHex, hexToBin, hash160, hash256,
  createVirtualMachineBch, instantiateSecp256k1,
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
const scripts = {
  ...t.scripts,
  vaultBare: t.scripts.vaultRedeemBytecode,
  unlockClaimBare: "<beneficiaryKey.schnorr_signature.all_outputs> <vaultSecret> OP_1",
};
for (const typeName of ["p2sh32", "p2sh", "standard"]) {
  try {
    const compiler = createCompilerBch({
      scripts, variables,
      lockingScriptTypes: { vaultBare: typeName },
      unlockingScripts: { unlockClaimBare: "vaultBare" },
    });
    const lockingResult = compiler.generateBytecode({ data: { bytecode: bytecodeVars }, scriptId: "vaultBare" });
    if (!lockingResult.success) { console.log(typeName, "locking FAIL", lockingResult.errors?.[0]?.error); continue; }
    const locking = lockingResult.bytecode;
    const spendingTx = {
      version: 2, locktime: 0,
      inputs: [{ outpointTransactionHash: hash256(utf8ToBin("fake-prev")), outpointIndex: 0, sequenceNumber: 0, unlockingBytecode: new Uint8Array() }],
      outputs: [{ lockingBytecode: hexToBin("76a914" + binToHex(hash160(beneficiaryPub)) + "88ac"), valueSatoshis: 19000n }],
    };
    const sourceOutputs = [{ lockingBytecode: locking, valueSatoshis: 20000n }];
    const unlockResult = compiler.generateBytecode({
      data: { keys: { privateKeys: { beneficiaryKey: beneficiaryPriv } }, bytecode: bytecodeVars, compilationContext: { inputIndex: 0, sourceOutputs, transaction: spendingTx } },
      scriptId: "unlockClaimBare", debug: true,
    });
    if (!unlockResult.success) { console.log(typeName, "unlock FAIL", JSON.stringify(unlockResult.errors?.[0])?.slice(0, 140)); continue; }
    spendingTx.inputs[0].unlockingBytecode = unlockResult.bytecode;
    const vm = createVirtualMachineBch();
    const verdict = vm.verify({ inputIndex: 0, sourceOutputs, transaction: spendingTx });
    console.log(typeName, "VM verdict:", typeof verdict === "string" ? verdict.slice(0, 130) : "SUCCESS");
  } catch (e) { console.log(typeName, "THREW:", e.message.slice(0, 120)); }
}
