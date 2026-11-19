process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
const { startBridge } = await import("./electrum-bridge.mjs");
const { default: WebSocket } = await import("ws");
const { decodeTransaction, binToHex, lockingBytecodeToCashAddress, hexToBin } = await import("@bitauth/libauth");
startBridge();
await new Promise((r) => setTimeout(r, 400));
const txid = process.argv[2];
const raw = await new Promise((resolve, reject) => {
  const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
  const to = setTimeout(() => reject(new Error("timeout")), 30000);
  ws.on("open", () => ws.send(JSON.stringify({ id: 1, method: "blockchain.transaction.get", params: [txid, false] })));
  ws.on("message", (m) => { const j = JSON.parse(m.toString()); if (j.id === 1) { clearTimeout(to); ws.close(); resolve(j.result); } });
  ws.on("error", reject);
});
const tx = decodeTransaction(hexToBin(raw));
if (typeof tx === "string") { console.log("decode error:", tx); process.exit(1); }
tx.outputs.forEach((o, i) => {
  const addr = lockingBytecodeToCashAddress({ bytecode: o.lockingBytecode, prefix: "bchtest" });
  console.log(`output ${i}: ${o.valueSatoshis} sats scriptLen=${o.lockingBytecode.length} script=${binToHex(o.lockingBytecode)}`);
});
console.log("locktime:", tx.locktime);
process.exit(0);
