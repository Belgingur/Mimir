#!/usr/bin/env node
/**
 * Vendoring manager for the bel-meteogram widget bundle.
 *
 *   node scripts/vendor-meteogram.mjs check   offline: committed bundle matches manifest.sha256
 *   node scripts/vendor-meteogram.mjs sync    download the pinned release asset, verify, write
 *
 * The vendored bundle is pinned in src/vendor/bel-meteogram/manifest.json to a
 * tagged release of github.com/Belgingur/meteogram. To bump the widget: edit
 * manifest.json (tag + sha256, both published in the release notes), then run
 * `npm run meteogram:sync`. CI runs `meteogram:check` so a copy that drifts
 * from the pinned checksum fails the build.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const vendorDir = join(here, "..", "src", "vendor", "bel-meteogram");
const manifestPath = join(vendorDir, "manifest.json");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const loadManifest = async () => JSON.parse(await readFile(manifestPath, "utf8"));

async function check() {
  const m = await loadManifest();
  const actual = sha256(await readFile(join(vendorDir, m.asset)));
  if (actual !== m.sha256) {
    console.error(
      `✗ vendored ${m.asset} does not match manifest.json (${m.tag}).\n` +
        `  expected ${m.sha256}\n` +
        `  actual   ${actual}\n` +
        `  Run 'npm run meteogram:sync', or correct manifest.json.`,
    );
    process.exit(1);
  }
  console.log(`✓ ${m.asset} matches manifest (${m.tag}, sha256 ${m.sha256.slice(0, 12)}…)`);
}

async function sync() {
  const m = await loadManifest();
  const url = `${m.repository}/releases/download/${m.tag}/${m.asset}`;
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`✗ download failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const actual = sha256(buf);
  if (actual !== m.sha256) {
    console.error(
      `✗ downloaded ${m.asset} sha256 does not match manifest.json.\n` +
        `  expected ${m.sha256}\n` +
        `  actual   ${actual}\n` +
        `  If you are bumping the widget, set manifest.sha256 to the value from\n` +
        `  the ${m.tag} release notes first, then re-run.`,
    );
    process.exit(1);
  }
  await writeFile(join(vendorDir, m.asset), buf);
  console.log(`✓ wrote ${m.asset} (${m.tag}, ${buf.length} bytes)`);
  console.log("  Reminder: keep bel-meteogram.d.ts in sync with the widget's public surface.");
}

const cmd = process.argv[2];
if (cmd === "check") await check();
else if (cmd === "sync") await sync();
else {
  console.error("usage: vendor-meteogram.mjs <check|sync>");
  process.exit(2);
}
