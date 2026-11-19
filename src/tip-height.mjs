// Current chipnet tip height via the bridge (blockchain.headers.subscribe).
process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
const { startBridge } = await import("./electrum-bridge.mjs");
const { default: WebSocket } = await import("ws");
startBridge();
await new Promise((r) => setTimeout(r, 400));
const height = await new Promise((resolve, reject) => {
  const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
  const to = setTimeout(() => reject(new Error("timeout")), 30000);
  ws.on("open", () => ws.send(JSON.stringify({ id: 1, method: "blockchain.headers.subscribe", params: [] })));
  ws.on("message", (m) => {
    const j = JSON.parse(m.toString());
    if (j.id === 1) { clearTimeout(to); ws.close(); resolve(j.result.height); }
  });
  ws.on("error", reject);
});
console.log(height);
process.exit(0);
