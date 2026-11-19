import { createCompilerBch, utf8ToBin } from "@bitauth/libauth";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const t = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const variables = {};
for (const [k, v] of Object.entries(t.variables)) variables[k] = { ...v, type: v.type === "private_key" ? "Key" : "WalletData" };
const compiler = createCompilerBch({
  scripts: t.scripts,
  variables,
  lockingScriptTypes: { vaultLockingBytecode: "standard" },
  unlockingScripts: { unlockClaim: "vaultLockingBytecode", unlockRefund: "vaultLockingBytecode" },
});
const fakeKey = () => new Uint8Array(randomBytes(32));
const data = {
  keys: { privateKeys: { beneficiaryKey: fakeKey(), funderKey: fakeKey() } },
  bytecode: {
    vaultSecret: utf8ToBin("ember-harvest-2026"),
    refundHeight: 335620,
    beneficiaryPublicKey: new Uint8Array(33),
    funderPublicKey: new Uint8Array(33),
  },
};
for (const scriptId of ["vaultRedeemBytecode", "vaultLockingBytecode", "unlockClaim", "unlockRefund"]) {
  const r = compiler.generateBytecode({ data, scriptId, debug: true });
  console.log(scriptId, r.success ? "OK len=" + r.bytecode.length : "FAIL " + (r.errors?.[0]?.error ?? r.errorType));
}
