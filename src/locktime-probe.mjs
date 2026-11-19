import {
  instantiateSecp256k1,
  hash160, binToHex, hexToBin, encodeCashAddress, CashAddressType,
  createCompilerBch, createVirtualMachineBch, encodeTransaction,
} from "@bitauth/libauth";
import { createHash, randomBytes } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

const secp = await instantiateSecp256k1();
const priv = new Uint8Array(randomBytes(32));
const pub = secp.derivePublicKeyCompressed(priv);
const pkh = hash160(pub);
const encoded = encodeCashAddress({ prefix: "bchtest", type: CashAddressType.p2pkh, payload: pkh });
const address = typeof encoded === "string" ? encoded : encoded.address;
console.log("probe address:", address);

// --- faucet (ninja PoW) ---
const base = "https://chipnet.bch.ninja/api";
async function api(path, body) {
  const res = await fetch(`${base}/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "curl/8.5.0" }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const ch = await api("challenge", { address, sats: "30000" });
const target = BigInt(`0x${ch.json.target}`);
let nonce = 0n;
while (BigInt(`0x${createHash("sha256").update(`${ch.json.payload}:${nonce}`).digest("hex")}`) > target) nonce++;
const claim = await api("claim", { payload: ch.json.payload, signature: ch.json.signature, nonce: nonce.toString() });
console.log("faucet txid:", claim.json.txid);
const faucetTxid = claim.json.txid;
await new Promise((r) => setTimeout(r, 8000));

// --- electrum via direct TLS through proxy (ninja) ---
const proxyUrl = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
function connectTls(host, port) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(Number(proxyUrl.port), proxyUrl.hostname);
    let buf = Buffer.alloc(0);
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      const idx = buf.indexOf("\r\n\r\n");
      if (idx === -1) return;
      sock.removeListener("data", onData);
      const head = buf.slice(0, idx).toString();
      if (!/^HTTP\/1\.[01] 200/.test(head)) return reject(new Error("CONNECT " + head.split("\r\n")[0]));
      const rest = buf.slice(idx + 4);
      const t = tls.connect({ socket: sock, servername: host }, () => resolve({ t, rest }));
      t.on("error", reject);
    };
    sock.on("data", onData);
    sock.on("error", reject);
    sock.on("connect", () => sock.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\nProxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString("base64")}\r\nProxy-Connection: Keep-Alive\r\nUser-Agent: curl/8.5.0\r\n\r\n`));
  });
}
const { t, rest } = await connectTls("chipnet.bch.ninja", 50002);
let buffer = rest.toString();
const pending = new Map();
let nextId = 1;
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    t.write(JSON.stringify({ id, method, params }) + "\n");
    setTimeout(() => reject(new Error("rpc timeout " + method)), 30000);
  });
}
t.on("data", (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try { const m = JSON.parse(line); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } } catch {}
  }
});
const tipRes = await rpc("blockchain.headers.subscribe", []);
const tip = tipRes.result.height;
console.log("tip:", tip);
const history = await rpc("blockchain.scripthash.get_history", [binToHex(hash256Local(pkh))]);
function hash256Local(pkhBytes) {
  const script = Uint8Array.from(Buffer.from("76a914" + binToHex(pkhBytes) + "88ac", "hex"));
  const h = createHash("sha256").update(script).digest();
  return new Uint8Array(h).reverse();
}
console.log("history entries:", JSON.stringify(history.result)?.slice(0, 160));

// --- build two spends of the faucet UTXO: first locktime=0, broadcast; it confirms or sits in mempool.
// For the locktime variant we need a SECOND utxo: request history may show only one. Instead: spend faucet utxo
// with locktime=0 into TWO outputs back to ourselves in tx1 (broadcast), then spend one of those in tx2 with locktime.
const compiler = createCompilerBch({
  scripts: {
    lock: "OP_DUP OP_HASH160 <key.hash160> OP_EQUALVERIFY OP_CHECKSIG",
    unlock: "<key.schnorr_signature.all_outputs> <key.public_key>",
  },
  variables: { key: { type: "Key" } },
  lockingScriptTypes: { lock: "p2pkh" },
  unlockingScripts: { unlock: "lock" },
});
function buildSpend({ utxoTxid, utxoIndex, utxoValue, outputs, locktime }) {
  const tx = {
    version: 2, locktime,
    inputs: [{ outpointTransactionHash: hexToBin(utxoTxid).reverse(), outpointIndex: utxoIndex, sequenceNumber: 0, unlockingBytecode: new Uint8Array() }],
    outputs: outputs.map((o) => ({ lockingBytecode: o.locking, valueSatoshis: o.value })),
  };
  const sourceOutputs = [{ lockingBytecode: hexToBin("76a914" + binToHex(pkh) + "88ac"), valueSatoshis: BigInt(utxoValue) }];
  const res = compiler.generateBytecode({
    data: { keys: { privateKeys: { key: priv } }, compilationContext: { inputIndex: 0, sourceOutputs, transaction: tx } },
    scriptId: "unlock",
  });
  if (!res.success) throw new Error("compile failed: " + JSON.stringify(res.errors?.[0])?.slice(0, 200));
  tx.inputs[0].unlockingBytecode = res.bytecode;
  const vm = createVirtualMachineBch();
  const verdict = vm.verify({ inputIndex: 0, sourceOutputs, transaction: tx });
  return { tx, verdict };
}
const selfLock = hexToBin("76a914" + binToHex(pkh) + "88ac");
const tx1 = buildSpend({ utxoTxid: faucetTxid, utxoIndex: 0, utxoValue: 30000, outputs: [{ locking: selfLock, value: 14000n }, { locking: selfLock, value: 15000n }], locktime: 0 });
console.log("tx1 vm:", typeof tx1.verdict === "string" ? tx1.verdict : "SUCCESS");
const b1 = await rpc("blockchain.transaction.broadcast", [binToHex(encodeTransaction(tx1.tx))]);
console.log("tx1 (locktime 0) broadcast:", JSON.stringify(b1).slice(0, 140));
const tx1id = b1.result;
if (tx1id) {
  const tx2 = buildSpend({ utxoTxid: tx1id, utxoIndex: 1, utxoValue: 15000, outputs: [{ locking: selfLock, value: 14000n }], locktime: tip - 50 });
  console.log("tx2 vm:", typeof tx2.verdict === "string" ? tx2.verdict : "SUCCESS", "locktime:", tip - 50);
  const b2 = await rpc("blockchain.transaction.broadcast", [binToHex(encodeTransaction(tx2.tx))]);
  console.log("tx2 (locktime tip-50) broadcast:", JSON.stringify(b2).slice(0, 200));
}
process.exit(0);
