// Prints the gzip size of each bundle in dist/ and fails when the ESM bundle
// (dist/index.js) is above the budget. Run after `npm run build`.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const LIMIT = 4096;
const files = ["dist/index.js", "dist/index.cjs", "dist/index.iife.js"];

let failed = false;
for (const file of files) {
  let bytes;
  try {
    bytes = gzipSync(readFileSync(file), { level: 9 }).length;
  } catch {
    console.error(`${file}: missing. Run \`npm run build\` first.`);
    process.exit(1);
  }
  const checked = file === "dist/index.js";
  const over = checked && bytes > LIMIT;
  if (over) failed = true;
  console.log(`${file}: ${bytes} B gzip${checked ? ` (limit ${LIMIT} B)` : ""}${over ? " OVER" : ""}`);
}

if (failed) {
  console.error(`dist/index.js is above ${LIMIT} B gzip.`);
  process.exit(1);
}
