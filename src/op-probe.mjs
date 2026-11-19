import { createCompilerBch } from "@bitauth/libauth";
const compiler = createCompilerBch({
  scripts: {
    t1: "OP_1",
    t2: "OP_TRUE",
    t3: "OP_0",
    t4: "OP_FALSE",
  },
  variables: {},
});
for (const id of ["t1", "t2", "t3", "t4"]) {
  const r = compiler.generateBytecode({ data: {}, scriptId: id });
  console.log(id, r.success ? "OK " + Buffer.from(r.bytecode).toString("hex") : "FAIL " + (r.errors?.[0]?.error ?? r.errorType));
}
