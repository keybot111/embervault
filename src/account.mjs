// Shared account bootstrap for the EmberVault XO demo: bridge + engine.
// The account mnemonic lives in account.json (mode 600, never committed).
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

import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { generateBip39Mnemonic } from "@bitauth/libauth";
import { randomBytes } from "node:crypto";

const ACCOUNT_FILE = new URL("../account.json", import.meta.url).pathname;

export function loadOrCreateAccount() {
  if (existsSync(ACCOUNT_FILE)) {
    return JSON.parse(readFileSync(ACCOUNT_FILE, "utf8"));
  }
  const account = {
    project: "EmberVault (Build With XO, BCH BLAZE 2026)",
    network: "chipnet",
    created: new Date().toISOString(),
    mnemonic: generateBip39Mnemonic(randomBytes(16)),
  };
  writeFileSync(ACCOUNT_FILE, JSON.stringify(account, null, 2));
  chmodSync(ACCOUNT_FILE, 0o600);
  return account;
}

export async function openEngine() {
  process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
  const { startBridge } = await import("./electrum-bridge.mjs");
  startBridge();
  await new Promise((r) => setTimeout(r, 400));
  const { Engine, XO_SUPPORTED_NETWORKS } = await import("@xo-cash/engine");
  const account = loadOrCreateAccount();
  const engine = await Engine.create(account.mnemonic, {
    network: XO_SUPPORTED_NETWORKS.chipnet,
  });
  return { engine, account };
}
