process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
const { startBridge } = await import("./electrum-bridge.mjs");
const { default: WebSocket } = await import("ws");
const { readFileSync } = await import("node:fs");
startBridge();
await new Promise((r) => setTimeout(r, 1200));
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/refund-built.json", import.meta.url), "utf8"));
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
    const to = setTimeout(() => reject(new Error("timeout")), 20000);
    ws.on("open", () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.on("message", (m) => { clearTimeout(to); ws.close(); resolve(JSON.parse(m.toString())); });
    ws.on("error", reject);
  });
}
for (let attempt = 1; attempt <= 5; attempt++) {
  const tip = await rpc("blockchain.headers.subscribe", []);
  const reply = await rpc("blockchain.transaction.broadcast", [serializedTransaction]);
  console.log(`attempt ${attempt}: tip=${tip.result?.height} reply=${JSON.stringify(reply).slice(0, 160)}`);
  if (reply.result) { console.log("BROADCAST OK txid:", reply.result); break; }
  if (attempt < 5) await new Promise((r) => setTimeout(r, 110000));
}
process.exit(0);
