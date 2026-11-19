// Probe: can the XO engine reach Chipnet Electrum from this machine?
import { Engine, XO_SUPPORTED_NETWORKS } from "@xo-cash/engine";
import { p2pkhTemplate } from "@xo-cash/templates";
import { generateBip39Mnemonic, hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
import { randomBytes } from "node:crypto";

const mnemonic = generateBip39Mnemonic(randomBytes(16));
console.log("test mnemonic generated (throwaway)");

const timeout = setTimeout(() => {
  console.log("RESULT: TIMEOUT — engine did not become ready in 45s (Electrum egress likely blocked)");
  process.exit(2);
}, 45000);

try {
  const engine = await Engine.create(mnemonic, { network: XO_SUPPORTED_NETWORKS.chipnet });
  const { templateIdentifier } = await engine.importTemplate(p2pkhTemplate);
  await engine.setDefaultPolicies({
    change: { templateIdentifier },
    receive: { templateIdentifier },
    address: { templateIdentifier },
  });
  const lb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
  const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: "bchtest" });
  console.log("RESULT: CONNECTED. chipnet receive address:", typeof addr === "string" ? addr : addr.address);
  const outs = await engine.listSpendableUnspentOutputs();
  console.log("spendable outputs:", outs.length);
  await engine.stop();
  clearTimeout(timeout);
  process.exit(0);
} catch (e) {
  clearTimeout(timeout);
  console.log("RESULT: ERROR —", e?.message || e);
  process.exit(1);
}
