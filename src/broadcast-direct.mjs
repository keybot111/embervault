import net from "node:net";
import tls from "node:tls";
import { readFileSync } from "node:fs";

const TARGET_HOST = process.argv[2] || "chipnet.bch.ninja";
const TARGET_PORT = 50002;
const proxyUrl = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
const proxy = { host: proxyUrl.hostname, port: Number(proxyUrl.port), auth: `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}` };

const { serializedTransaction } = JSON.parse(readFileSync(new URL("../artifacts/refund-built.json", import.meta.url), "utf8"));

function connectViaProxy() {
  return new Promise((resolve, reject) => {
    const sock = net.connect(proxy.port, proxy.host);
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      const idx = buf.indexOf("\r\n\r\n");
      if (idx === -1) return;
      sock.removeListener("data", onData);
      const head = buf.slice(0, idx).toString();
      if (!/^HTTP\/1\.[01] 200/.test(head)) return reject(new Error("CONNECT failed: " + head.split("\r\n")[0]));
      const rest = buf.slice(idx + 4);
      const tlsSock = tls.connect({ socket: sock, servername: TARGET_HOST }, () => resolve({ tlsSock, rest }));
      tlsSock.on("error", reject);
    };
    sock.on("data", onData);
    sock.on("error", reject);
    sock.on("connect", () => {
      sock.write(`CONNECT ${TARGET_HOST}:${TARGET_PORT} HTTP/1.1\r\nHost: ${TARGET_HOST}:${TARGET_PORT}\r\nProxy-Authorization: Basic ${Buffer.from(proxy.auth).toString("base64")}\r\nProxy-Connection: Keep-Alive\r\nUser-Agent: curl/8.5.0\r\n\r\n`);
    });
  });
}

const { tlsSock, rest } = await connectViaProxy();
console.log("TLS up to", TARGET_HOST);
let buffer = rest.toString();
const pending = new Map();
let nextId = 1;
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    tlsSock.write(JSON.stringify({ id, method, params }) + "\n");
    setTimeout(() => reject(new Error("rpc timeout " + method)), 30000);
  });
}
tlsSock.on("data", (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch {}
  }
});
const ver = await rpc("server.version", ["direct-probe", "1.4"]);
console.log("server.version:", JSON.stringify(ver).slice(0, 140));
const tip = await rpc("blockchain.headers.subscribe", []);
console.log("tip:", tip.result?.height);
const reply = await rpc("blockchain.transaction.broadcast", [serializedTransaction]);
console.log("broadcast:", JSON.stringify(reply).slice(0, 220));
process.exit(0);
