process.env.BRIDGE_LISTEN_PORT = "50004";
process.env.BRIDGE_TARGET_HOST = "chipnet.bch.ninja";
const { startBridge } = await import("./electrum-bridge.mjs");
const { default: WebSocket } = await import("ws");
const { readFileSync } = await import("node:fs");
startBridge();
await new Promise((r) => setTimeout(r, 1500));
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/refund-built.json", import.meta.url), "utf8"));
function rpc(method, params) {
  return new Promise((resolve) => {
    const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
    const to = setTimeout(() => resolve({ error: "timeout" }), 25000);
    ws.on("open", () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.on("message", (m) => { clearTimeout(to); ws.close(); resolve(JSON.parse(m.toString())); });
    ws.on("error", (e) => { clearTimeout(to); resolve({ error: String(e) }); });
  });
}
const ver = await rpc("server.version", ["probe", "1.4"]);
console.log("ninja server.version:", JSON.stringify(ver).slice(0, 140));
const tip = await rpc("blockchain.headers.subscribe", []);
console.log("ninja tip:", tip.result?.height);
const reply = await rpc("blockchain.transaction.broadcast", [serializedTransaction]);
console.log("ninja broadcast:", JSON.stringify(reply).slice(0, 220));
process.exit(0);
