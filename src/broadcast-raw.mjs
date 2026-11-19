process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
const { startBridge } = await import("./electrum-bridge.mjs");
const { default: WebSocket } = await import("ws");
const { readFileSync } = await import("node:fs");
startBridge();
await new Promise((r) => setTimeout(r, 1200));
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/refund-built.json", import.meta.url), "utf8"));
const reply = await new Promise((resolve, reject) => {
  const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
  const to = setTimeout(() => reject(new Error("timeout")), 30000);
  ws.on("open", () => ws.send(JSON.stringify({ id: 1, method: "blockchain.transaction.broadcast", params: [serializedTransaction] })));
  ws.on("message", (m) => { clearTimeout(to); ws.close(); resolve(m.toString()); });
  ws.on("error", reject);
});
console.log("BROADCAST REPLY:", reply.slice(0, 300));
process.exit(0);
