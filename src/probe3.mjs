// Probe 3: the XO engine with DEFAULT electrum servers, where DNS for the
// chipnet hosts is patched to the local bridge and Node trusts the system CA
// store (which includes the bridge CA). Run with: NODE_OPTIONS=--use-system-ca
import dns from "node:dns";
const origLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === "function") { callback = options; options = {}; }
  if (hostname === "chipnet.imaginary.cash" || hostname === "chipnet.bch.ninja") {
    if (options?.all) return callback(null, [{ address: "127.0.0.1", family: 4 }]);
    return callback(null, "127.0.0.1", 4);
  }
  return origLookup(hostname, options, callback);
};

const { startBridge } = await import("./electrum-bridge.mjs");
process.env.BRIDGE_LISTEN_PORT = "50004";
startBridge();
await new Promise((r) => setTimeout(r, 500));

const { Engine, XO_SUPPORTED_NETWORKS } = await import("@xo-cash/engine");
const { p2pkhTemplate } = await import("@xo-cash/templates");
const { generateBip39Mnemonic, hexToBin, lockingBytecodeToCashAddress } = await import("@bitauth/libauth");
const { randomBytes } = await import("node:crypto");

const mnemonic = generateBip39Mnemonic(randomBytes(16));
const timeout = setTimeout(() => { console.log("RESULT: TIMEOUT after 120s"); process.exit(2); }, 120000);
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
  console.log("RESULT: ENGINE ONLINE via bridge. chipnet address:", typeof addr === "string" ? addr : addr.address);
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
