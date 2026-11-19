process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";

const { default: WebSocket } = await import("ws");

await new Promise((r) => setTimeout(r, 1000));
function rpc(method, params) {
  return new Promise((resolve) => {
    const ws = new WebSocket("wss://127.0.0.1:50004", { rejectUnauthorized: false });
    const to = setTimeout(() => resolve({ error: "timeout" }), 20000);
    ws.on("open", () => ws.send(JSON.stringify({ id: 1, method, params })));
    ws.on("message", (m) => { clearTimeout(to); ws.close(); resolve(JSON.parse(m.toString())); });
    ws.on("error", (e) => { clearTimeout(to); resolve({ error: String(e) }); });
  });
}
for (const txid of process.argv.slice(2)) {
  const r = await rpc("blockchain.transaction.get", [txid, true]);
  console.log(txid.slice(0, 12), "block_height:", r.result?.block_height, "confirmations:", r.result?.confirmations, r.error ? JSON.stringify(r.error).slice(0, 100) : "");
}
process.exit(0);
