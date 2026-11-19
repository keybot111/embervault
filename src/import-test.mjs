import { openEngine } from "./account.mjs";
import { readFileSync } from "node:fs";
const template = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine();
try {
  const { templateIdentifier } = await engine.importTemplate(template);
  console.log("IMPORT OK. templateIdentifier:", templateIdentifier);
  await engine.setDefaultPolicies({
    change: { templateIdentifier },
    receive: { templateIdentifier },
    address: { templateIdentifier },
  });
  console.log("DEFAULT POLICIES OK");
  const { hexToBin, lockingBytecodeToCashAddress } = await import("@bitauth/libauth");
  const lb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
  const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: "bchtest" });
  console.log("EmberVault-template receive address:", typeof addr === "string" ? addr : addr.address);
} catch (e) {
  console.log("IMPORT ERROR:", e?.message || e);
  if (e?.errors) console.log(JSON.stringify(e.errors).slice(0, 1500));
}
await engine.stop();
process.exit(0);
