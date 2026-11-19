process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
const { startBridge } = await import("./electrum-bridge.mjs");
const { default: WebSocket } = await import("ws");
const { readFileSync } = await import("node:fs");
startBridge();
await new Promise((r) => setTimeout(r, 1200));
const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/refund-built.json", import.meta.url), "utf8"));
function rpc(method, params) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
      const to = setTimeout(() => { try { ws.close(); } catch {} finish({ error: "timeout" }); }, 20000);
      ws.on("open", () => ws.send(JSON.stringify({ id: 1, method, params })));
      ws.on("message", (m) => { clearTimeout(to); try { ws.close(); } catch {} finish(JSON.parse(m.toString())); });
      ws.on("error", (e) => { clearTimeout(to); finish({ error: String(e?.message || e) }); });
    } catch (e) { finish({ error: String(e) }); }
  });
}
for (let attempt = 1; attempt <= 10; attempt++) {
  const tip = await rpc("blockchain.headers.subscribe", []);
  const reply = await rpc("blockchain.transaction.broadcast", [serializedTransaction]);
  console.log(`attempt ${attempt}: tip=${tip.result?.height ?? "?"} reply=${JSON.stringify(reply).slice(0, 140)}`);
  if (reply.result) { console.log("BROADCAST OK txid:", reply.result); break; }
  if (attempt < 10) await new Promise((r) => setTimeout(r, 240000));
}
process.exit(0);
