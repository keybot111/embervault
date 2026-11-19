import { openEngine } from "./accounts.mjs";
const { engine } = await openEngine(process.argv[2] || "beneficiary");
await engine.archiveInvitation(process.argv[3]);
console.log("archived", process.argv[3]);
await engine.stop();
process.exit(0);
