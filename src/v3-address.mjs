import { openEngine } from "./accounts.mjs";
import { readFileSync } from "node:fs";
import { hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
const t = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
const { engine } = await openEngine("funder");
const { templateIdentifier } = await engine.importTemplate(t);
console.log("V3 TEMPLATE ID:", templateIdentifier);
await engine.setDefaultPolicies({
  change: { templateIdentifier },
  receive: { templateIdentifier },
  address: { templateIdentifier },
});
const lb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: "bchtest" });
console.log("V3 RECEIVE:", typeof addr === "string" ? addr : addr.address);
await engine.stop();
process.exit(0);
