import { createCompilerBch, binToHex, utf8ToBin, sha256 } from "@bitauth/libauth";
import { multisigTemplate } from "@xo-cash/templates";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const fakeKey = () => new Uint8Array(randomBytes(32));

// 1) multisig locking script with only first signer's key
{
  const compiler = createCompilerBch({
    scripts: multisigTemplate.scripts,
    variables: Object.fromEntries(Object.entries(multisigTemplate.variables).map(([k, v]) => [k, { ...v, type: v.type === "private_key" ? "Key" : "WalletData" }])),
  });
  const result = compiler.generateBytecode({
    data: { keys: { privateKeys: { firstSignerKey: fakeKey() } } },
    scriptId: "multiSigLockingBytecode",
    debug: true,
  });
  console.log("MULTISIG success:", result.success, "errorType:", result.errorType);
  if (!result.success) for (const e of result.errors) console.log("  err:", JSON.stringify(e).slice(0, 220));
}

// 2) embervault: redeem script compiled directly + via the P2SH wrapper
{
  const t = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
  const variables = {};
  for (const [k, v] of Object.entries(t.variables)) variables[k] = { ...v, type: v.type === "private_key" ? "Key" : "WalletData" };
  const compiler = createCompilerBch({ scripts: t.scripts, variables });
  const data = {
    keys: { privateKeys: { funderKey: fakeKey() } },
    bytecode: { vaultSecret: utf8ToBin("ember-harvest-2026"), refundHeight: 335611 },
  };
  for (const scriptId of ["vaultRedeemBytecode", "vaultLockingBytecode"]) {
    const result = compiler.generateBytecode({ data, scriptId, debug: true });
    console.log("EMBER", scriptId, "success:", result.success, "errorType:", result.errorType);
    if (!result.success) for (const e of result.errors) console.log("  err:", JSON.stringify(e).slice(0, 220));
    if (result.success) console.log("  bytecode:", binToHex(result.bytecode).slice(0, 60), "…");
  }
}
