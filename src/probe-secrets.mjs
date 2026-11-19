import { openEngine } from "./accounts.mjs";
import { readFileSync } from "node:fs";
const emberTemplate = JSON.parse(readFileSync(new URL("../template.json", import.meta.url), "utf8"));
for (const name of ["funder", "beneficiary"]) {
  const { engine } = await openEngine(name);
  await engine.importTemplate(emberTemplate);
  const data = await engine.listSecretData();
  console.log(name, "secrets:", JSON.stringify(data, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 700));
  await engine.stop();
}
process.exit(0);
