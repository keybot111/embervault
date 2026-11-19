// Electrum bridge: exposes a plain ws:// Electrum endpoint on localhost and
// relays it, message-for-message, to a real Electrum server reached through
// this environment's HTTP CONNECT proxy (direct egress is blocked here).
//
//   engine ──ws──► 127.0.0.1:50003 (this bridge) ──CONNECT tunnel + TLS──► chipnet.imaginary.cash:50002
//
// Electrum's protocol is newline-delimited JSON-RPC; WebSocket messages map
// 1:1 onto protocol lines.

import net from "node:net";
import tls from "node:tls";
import https from "node:https";
import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";

const TARGET_HOST = process.env.BRIDGE_TARGET_HOST || "chipnet.imaginary.cash";
const TARGET_PORT = Number(process.env.BRIDGE_TARGET_PORT || 50002); // tcp_tls
const LISTEN_PORT = Number(process.env.BRIDGE_LISTEN_PORT || 50003);

function proxyConfig() {
  const raw = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy;
  if (!raw) throw new Error("no proxy env var set");
  const u = new URL(raw);
  return {
    host: u.hostname.replace(/^\[|\]$/g, ""),
    port: Number(u.port || 3128),
    auth: u.username
      ? "Basic " + Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")
      : null,
  };
}

function openTunnel(targetHost, targetPort, cb) {
  const proxy = proxyConfig();
  const sock = net.connect(proxy.port, proxy.host);
  let buf = Buffer.alloc(0);
  let done = false;
  sock.on("connect", () => {
    const lines = [
      `CONNECT ${targetHost}:${targetPort} HTTP/1.1`,
      `Host: ${targetHost}:${targetPort}`,
      ...(proxy.auth ? [`Proxy-Authorization: ${proxy.auth}`] : []),
      // The egress proxy silently drops CONNECT requests without these.
      "Proxy-Connection: Keep-Alive",
      "User-Agent: curl/8.5.0",
      "",
      "",
    ];
    sock.write(lines.join("\r\n"));
  });
  sock.on("data", (chunk) => {
    if (done) return;
    buf = Buffer.concat([buf, chunk]);
    const idx = buf.indexOf("\r\n\r\n");
    if (idx === -1) return;
    const head = buf.subarray(0, idx).toString("latin1");
    if (!/^HTTP\/1\.[01] 200/.test(head)) {
      done = true;
      cb(new Error(`proxy CONNECT failed: ${head.split("\r\n")[0]}`));
      sock.destroy();
      return;
    }
    done = true;
    const rest = buf.subarray(idx + 4);
    // Critical: detach this listener before handing the socket to TLS,
    // otherwise it keeps consuming (and discarding) the TLS stream's bytes.
    sock.removeAllListeners("data");
    cb(null, sock, rest);
  });
  sock.on("error", (e) => { if (!done) { done = true; cb(e); } });
}

export function startBridge() {
  // The XO electrum client insists on the wss transport. Serve WSS with a
  // local self-signed cert (the electrum-cash client does not pin certs).
  let server = null;
  try {
    server = https.createServer({
      key: readFileSync(new URL("../.bridge/server.key", import.meta.url)),
      cert: readFileSync(new URL("../.bridge/server.pem", import.meta.url)),
    });
  } catch { /* fall back to plain ws */ }
  const wss = server
    ? new WebSocketServer({ server })
    : new WebSocketServer({ host: "127.0.0.1", port: LISTEN_PORT });
  if (server) server.listen(LISTEN_PORT, "127.0.0.1");
  wss.on("listening", () => {
    console.error(`[bridge] ${server ? "wss" : "ws"}://127.0.0.1:${LISTEN_PORT} -> ${TARGET_HOST}:${TARGET_PORT} via CONNECT proxy`);
  });
  wss.on("connection", (ws) => {
    // Attach the message handler immediately: clients may speak before the
    // upstream tunnel is ready, and unlistened 'message' events are dropped.
    let upstreamReady = false;
    const queuedWrites = [];
    let writeUpstream = (line) => queuedWrites.push(line);
    ws.on("message", (msg) => {
      const text = msg.toString();
      writeUpstream(text.endsWith("\n") ? text : text + "\n");
    });
    ws.on("error", () => {});
    openTunnel(TARGET_HOST, TARGET_PORT, (err, rawSock, rest) => {
      if (err) {
        console.error("[bridge] tunnel error:", err.message);
        ws.close(1011, "tunnel failed");
        return;
      }
      const tlsSock = tls.connect({ socket: rawSock, servername: TARGET_HOST });
      let pending = rest && rest.length ? rest : Buffer.alloc(0);
      let textBuf = "";
      const onData = (chunk) => {
        textBuf += chunk.toString("utf8");
        let nl;
        while ((nl = textBuf.indexOf("\n")) !== -1) {
          const line = textBuf.slice(0, nl).trim();
          textBuf = textBuf.slice(nl + 1);
          if (line && ws.readyState === ws.OPEN) ws.send(line);
        }
      };
      tlsSock.on("secureConnect", () => {
        console.error("[bridge] upstream TLS established");
        upstreamReady = true;
        writeUpstream = (line) => tlsSock.write(line);
        for (const q of queuedWrites) tlsSock.write(q);
        queuedWrites.length = 0;
        if (pending.length) onData(pending);
        tlsSock.on("data", onData);
      });
      tlsSock.on("error", (e) => { console.error("[bridge] tls error:", e.message); ws.close(1011, "tls error"); });
      tlsSock.on("close", () => { if (ws.readyState === ws.OPEN) ws.close(1000, "upstream closed"); });
      ws.on("close", () => tlsSock.destroy());
      ws.on("error", () => tlsSock.destroy());
    });
  });
  return wss;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBridge();
}
