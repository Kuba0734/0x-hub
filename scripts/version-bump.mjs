// Usage: pnpm version:bump <x.y.z>
// Syncs the version across package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: pnpm version:bump <x.y.z>");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..");

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const confPath = resolve(root, "src-tauri/tauri.conf.json");
const conf = JSON.parse(readFileSync(confPath, "utf8"));
conf.version = version;
writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");

const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const cargo = readFileSync(cargoPath, "utf8");
// Only the first `version = ` line, which belongs to [package].
const nextCargo = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
if (nextCargo === cargo && !cargo.includes(`version = "${version}"`)) {
  console.error("Could not find the package version in Cargo.toml");
  process.exit(1);
}
writeFileSync(cargoPath, nextCargo);

console.log(`Version set to ${version}`);
