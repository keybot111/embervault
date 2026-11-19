import { openEngine } from "./accounts.mjs";
const { engine } = await openEngine(process.argv[2] || "funder");
const id = process.argv[3];
const stored = await engine.getInvitation(id);
if (!stored) { console.log("not stored"); process.exit(0); }
console.log("commits:", stored.invitation.commits.map((c) => `${c.commitIdentifier.slice(0, 8)} keys=[${Object.keys(c.data ?? {})}]`));
console.log("result:", JSON.stringify(stored.invitation.result)?.slice(0, 150));
try {
  const missing = await engine.listMissingRequirements(id);
  console.log("missing:", JSON.stringify(missing).slice(0, 300));
} catch (e) { console.log("missing ERROR:", (e?.message || String(e)).slice(0, 200)); }
await engine.stop();
process.exit(0);
