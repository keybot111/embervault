import { createHash } from "node:crypto";

const address = process.argv[2];
const sats = process.argv[3] || "50000";
const base = "https://chipnet.bch.ninja/api";

async function api(path, body) {
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "curl/8.5.0" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch { return { status: res.status, json: { raw: text.slice(0, 200) } }; }
}

const challenge = await api("challenge", { address, sats });
console.log("challenge status:", challenge.status, JSON.stringify(challenge.json).slice(0, 200));
const { payload, signature, target, expectedHashes, expires } = challenge.json;
if (!payload || !target) { console.log("NO CHALLENGE"); process.exit(1); }
const targetBig = BigInt(`0x${target}`);
console.log("grinding, expectedHashes:", expectedHashes);
let nonce = 0n;
const started = Date.now();
while (true) {
  const digest = createHash("sha256").update(`${payload}:${nonce}`).digest("hex");
  if (BigInt(`0x${digest}`) <= targetBig) break;
  nonce++;
  if (Date.now() > expires) { console.log("EXPIRED at nonce", nonce.toString()); process.exit(2); }
}
console.log("nonce found:", nonce.toString(), "in", ((Date.now() - started) / 1000).toFixed(1), "s");
const claim = await api("claim", { payload, signature, nonce: nonce.toString() });
console.log("claim status:", claim.status, JSON.stringify(claim.json).slice(0, 300));
