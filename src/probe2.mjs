// Probe 2: engine through the local Electrum bridge.
import { startBridge } from "./electrum-bridge.mjs";
import { Engine, XO_SUPPORTED_NETWORKS, resolveElectrumServersForNetwork } from "@xo-cash/engine";
import { p2pkhTemplate } from "@xo-cash/templates";
import { generateBip39Mnemonic, hexToBin, lockingBytecodeToCashAddress } from "@bitauth/libauth";
import { randomBytes } from "node:crypto";

startBridge();
await new Promise((r) => setTimeout(r, 500));

const defaults = resolveElectrumServersForNetwork(XO_SUPPORTED_NETWORKS.chipnet);
const bridged = defaults.map((s) => ({
  ...s,
  host: "127.0.0.1",
  transports: { wss: 50003 },
}));
console.log("bridged servers:", bridged.map((s) => `${s.host} blockchain-height-checkpoint=${s.blockchain.checkpoint.height}`).join("; "));

const mnemonic = generateBip39Mnemonic(randomBytes(16));
const timeout = setTimeout(() => {
  console.log("RESULT: TIMEOUT after 60s");
  process.exit(2);
}, 60000);

try {
  const engine = await Engine.create(mnemonic, {
    network: XO_SUPPORTED_NETWORKS.chipnet,
    electrumServers: bridged,
  });
  const { templateIdentifier } = await engine.importTemplate(p2pkhTemplate);
  await engine.setDefaultPolicies({
    change: { templateIdentifier },
    receive: { templateIdentifier },
    address: { templateIdentifier },
  });
  const lb = await engine.generateLockingBytecodeFromDefaultPolicy("receive");
  const addr = lockingBytecodeToCashAddress({ bytecode: hexToBin(lb), prefix: "bchtest" });
  console.log("RESULT: CONNECTED via bridge. chipnet address:", typeof addr === "string" ? addr : addr.address);
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
