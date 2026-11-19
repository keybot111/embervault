import { openEngine } from "./account.mjs";
import { p2pkhTemplate } from "@xo-cash/templates";
import { hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
const { engine } = await openEngine();
const { templateIdentifier } = await engine.importTemplate(p2pkhTemplate);
await engine.setDefaultPolicies({
  change: { templateIdentifier },
  receive: { templateIdentifier },
  address: { templateIdentifier },
});
const lb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: "bchtest" });
console.log("FUNDING ADDRESS:", typeof addr === "string" ? addr : addr.address);
const outs = await engine.listSpendableUnspentOutputs();
console.log("spendable outputs:", outs.length);
await engine.stop();
process.exit(0);
