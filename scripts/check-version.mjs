// Usage: node scripts/check-version.mjs [vX.Y.Z]
// Fails if package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json disagree,
// or if they don't match the given tag.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const conf = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf8")).version;
const cargo = readFileSync(resolve(root, "src-tauri/Cargo.toml"), "utf8").match(/^version = "(.*)"$/m)?.[1];

const versions = { "package.json": pkg, "Cargo.toml": cargo, "tauri.conf.json": conf };
const unique = new Set(Object.values(versions));
if (unique.size !== 1) {
  console.error("Version mismatch:", versions);
  process.exit(1);
}

const tag = process.argv[2];
if (tag && tag.replace(/^v/, "") !== pkg) {
  console.error(`Tag ${tag} does not match version ${pkg}`);
  process.exit(1);
}
console.log(`Version ${pkg} OK`);
