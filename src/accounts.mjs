// Two-account bootstrap for the EmberVault demo (funder + beneficiary are
// distinct XO entities — the engine forbids one entity holding both roles).
// Mnemonics live in account-<name>.json files (mode 600, never committed).
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

export function loadOrCreateAccount(name) {
  const file = new URL(`../account-${name}.json`, import.meta.url).pathname;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const account = {
    project: "EmberVault (Build With XO, BCH BLAZE 2026)",
    role: name,
    network: "chipnet",
    created: new Date().toISOString(),
    mnemonic: generateBip39Mnemonic(randomBytes(16)),
  };
  writeFileSync(file, JSON.stringify(account, null, 2));
  chmodSync(file, 0o600);
  return account;
}

export async function openEngine(name) {
  process.env.BRIDGE_LISTEN_PORT = process.env.BRIDGE_LISTEN_PORT || "50004";
  const { startBridge } = await import("./electrum-bridge.mjs");
  startBridge();
  await new Promise((r) => setTimeout(r, 1500));
  const { Engine, XO_SUPPORTED_NETWORKS } = await import("@xo-cash/engine");
  const account = loadOrCreateAccount(name);
  const engine = await Engine.create(account.mnemonic, {
    network: XO_SUPPORTED_NETWORKS.chipnet,
  });
  return { engine, account };
}

import { binToHex, hexToBin } from "@bitauth/libauth";

// Invitations contain Uint8Array fields (outpoint hashes, keys). Plain JSON
// would corrupt them, so they are tagged as {"$bin": "<hex>"} on disk.
function replacer(k, v) {
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Uint8Array) return { $bin: binToHex(v) };
  if (v && typeof v === "object" && v.type === "Buffer" && Array.isArray(v.data)) {
    return { $bin: binToHex(new Uint8Array(v.data)) };
  }
  return v;
}
function reviver(k, v) {
  if (v && typeof v === "object" && typeof v.$bin === "string" && Object.keys(v).length === 1) {
    return hexToBin(v.$bin);
  }
  return v;
}

export const jsonIO = {
  write(path, obj) {
    writeFileSync(path, JSON.stringify(obj, replacer, 2));
  },
  read(path) {
    return JSON.parse(readFileSync(path, "utf8"), reviver);
  },
};

// The public key (hex) of the most recently generated secret for a template —
// used to share public key variables after a role generates its key.
export async function ownPublicKeyHex(engine, templateIdentifier, secretIdentifier) {
  const secrets = await engine.listSecretData();
  const mine = secrets.filter(
    (s) => s.templateIdentifier === templateIdentifier && s.secretIdentifier === secretIdentifier && s.isEntropy
  );
  if (mine.length === 0) throw new Error(`no secret ${secretIdentifier} for template`);
  mine.sort((a, b) => Number(b.value) - Number(a.value));
  return engine.getSecretPublicKey(mine[0].secretLookupKey);
}

// Canonical invitation codec from @xo-cash/utils — use this (not raw JSON)
// for anything that crosses between accounts/processes.
export const invitationIO = {
  async write(path, invitation) {
    const { serializeInvitation } = await import("@xo-cash/utils");
    writeFileSync(path, serializeInvitation(invitation));
  },
  async read(path) {
    const { deserializeInvitation } = await import("@xo-cash/utils");
    return deserializeInvitation(readFileSync(path, "utf8"));
  },
};
