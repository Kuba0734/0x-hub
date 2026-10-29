#!/usr/bin/env node
// Writes the release commit/tag message for deploy.bat:
//
//   node scripts/release-notes.mjs <version> <out-file> [message]
//   RELEASE_NOTES_FROM=v0.1.4 node scripts/release-notes.mjs ...   (start from another ref)
//
// Line 1 is the commit subject (vX.Y.Z), then a blank line, then the notes that the release
// workflow publishes as the GitHub release body (shown in the in-app update dialog too):
// the optional message, then the commits since the previous tag grouped by type. Plain
// text on purpose: the app shows it as-is, GitHub renders the "-" lines as a list.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [version, outFile, ...rest] = process.argv.slice(2);
const message = rest.join(" ").trim();
if (!version || !outFile) {
  console.error("usage: release-notes.mjs <version> <out-file> [message]");
  process.exit(1);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

// RELEASE_NOTES_FROM=<ref> overrides the previous tag (handy for a dry run).
let previous = process.env.RELEASE_NOTES_FROM ?? "";
if (!previous) {
  try {
    previous = git("describe", "--tags", "--abbrev=0");
  } catch {
    // First release: every commit counts.
  }
}
const range = previous ? [`${previous}..HEAD`] : [];
const subjects = git("log", ...range, "--no-merges", "--pretty=format:%s")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const groups = [
  { title: "New", types: ["feat"] },
  { title: "Fixes", types: ["fix"] },
  { title: "Faster", types: ["perf"] },
];
const sections = new Map(groups.map((g) => [g.title, []]));

for (const subject of subjects) {
  // Release commits themselves ("v0.1.6", "chore(release): v0.1.5") never show up.
  if (/^(chore\(release\): )?v\d+\.\d+\.\d+$/.test(subject)) continue;
  const m = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/.exec(subject);
  if (!m) continue;
  const group = groups.find((g) => g.types.includes(m[1].toLowerCase()));
  if (!group) continue; // chore, ci, docs, refactor, style, test, build: not user-facing
  const text = m[2].charAt(0).toUpperCase() + m[2].slice(1);
  sections.get(group.title).push(`- ${text}`);
}

const blocks = [];
if (message) blocks.push(message);
for (const g of groups) {
  const lines = sections.get(g.title);
  if (lines.length) blocks.push(`${g.title}\n${lines.join("\n")}`);
}
if (blocks.length === 0) blocks.push("- Small improvements and maintenance");

const text = `v${version}\n\n${blocks.join("\n\n")}\n`;
writeFileSync(outFile, text, "utf8");
process.stdout.write(text);
