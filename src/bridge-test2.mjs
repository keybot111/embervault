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
process.env.BRIDGE_LISTEN_PORT = "50004";
const { startBridge } = await import("./electrum-bridge.mjs");
startBridge();
await new Promise((r) => setTimeout(r, 1000));
const { default: WebSocket } = await import("ws");
const ws = new WebSocket("wss://chipnet.imaginary.cash:50004"); // verified TLS, like the engine
ws.on("open", () => { console.log("WS OPEN (verified)"); ws.send(JSON.stringify({ id: 1, method: "server.version", params: ["probe", "1.4"] })); });
ws.on("message", (m) => { console.log("WS MSG:", m.toString().slice(0, 120)); process.exit(0); });
ws.on("error", (e) => { console.log("WS ERROR:", e.message); process.exit(1); });
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 20000);
