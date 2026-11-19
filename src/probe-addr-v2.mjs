import { openEngine } from "./accounts.mjs";
import { readFileSync } from "node:fs";
import { hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
const t2 = JSON.parse(readFileSync(new URL("../template-v2.json", import.meta.url), "utf8"));
const { engine } = await openEngine("funder");
const { templateIdentifier } = await engine.importTemplate(t2);
console.log("v2 template id:", templateIdentifier);
await engine.setDefaultPolicies({
  change: { templateIdentifier },
  receive: { templateIdentifier },
  address: { templateIdentifier },
});
for (let i = 0; i < 2; i++) {
  const lb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
  const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: "bchtest" });
  console.log("v2 receive", i, ":", typeof addr === "string" ? addr : addr.address);
}
await engine.stop();
process.exit(0);
