/**
 * test/run-all.mjs — اجرای همه‌ی تست‌ها
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tests = ["unit.test.mjs", "integration.test.mjs"];

let failed = 0;
for (const t of tests) {
  console.log(`\n━━━ ${t} ━━━`);
  const r = spawnSync(process.execPath, [path.join(dir, t)], { stdio: "inherit" });
  if (r.status !== 0) {
    failed++;
    console.error(`✗ ${t} FAILED (exit ${r.status})`);
  } else {
    console.log(`✓ ${t} passed`);
  }
}

if (failed) {
  console.error(`\n${failed} test file(s) failed`);
  process.exit(1);
}
console.log("\nALL TEST FILES PASSED");
