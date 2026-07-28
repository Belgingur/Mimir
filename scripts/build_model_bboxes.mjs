#!/usr/bin/env node
/**
 * Generate models.json coverage metadata (bbox + resolution_km) from the live
 * forecast catalog manifests (task A2). Walks each model's analyses -> variables
 * -> manifest.json, unions the per-variable `bounds` into the model domain bbox,
 * and reads `rendering.resolutionMeters` (falling back to the built-in table).
 *
 * Usage:
 *   node scripts/build_model_bboxes.mjs <root-url> [--user U --password P] > models.json
 *
 *   <root-url> is the origin that serves the catalog, e.g.
 *     https://mimir.belgingur.is        (forecast-data is appended automatically)
 *   or a bare path if you serve it elsewhere.
 *
 * The model list + existing fields (id, title, default, available/disabled) are
 * read from the live <root-url>/forecast-data/models.json; bbox + resolution_km
 * are (re)filled from the manifests. Output goes to stdout.
 */


const RESOLUTION_METERS = {
  GWES: 25000,
  ECMWF: 25000,
  GFS: 25000,
  RAP: 13000,
  "ICON-EU": 7000,
  "ECMWF-IS": 10000,
  "BEL-BR": 3200,
  "BEL-FO": 3000,
  "BEL-IS": 2000,
  "UWC-IG": 2000,
  "UWC-DINI": 2000,
};

const root = process.argv[2];
if (!root) {
  console.error("Usage: node scripts/build_model_bboxes.mjs <root-url> [--user U --password P]");
  process.exit(1);
}
const userIdx = process.argv.indexOf("--user");
const passIdx = process.argv.indexOf("--password");
const auth =
  userIdx > -1 && passIdx > -1
    ? "Basic " +
      Buffer.from(`${process.argv[userIdx + 1]}:${process.argv[passIdx + 1]}`).toString("base64")
    : null;

const base = `${root.replace(/\/$/, "")}/forecast-data`;

async function getJson(url) {
  const res = await fetch(url, auth ? { headers: { Authorization: auth } } : undefined);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** Accept a bare id array OR { models|analyses|variables: [ id | {id,default} ] }. */
function ids(data, key) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
  return list.map((x) => (x && typeof x === "object" ? String(x.id) : String(x))).filter(Boolean);
}
function defaultId(data, key) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : [];
  const d = list.find((x) => x && typeof x === "object" && x.default);
  return d ? String(d.id) : "";
}

async function modelBBox(model) {
  const analyses = await getJson(`${base}/${model}/analyses.json`);
  const analysis = defaultId(analyses, "analyses") || ids(analyses, "analyses")[0];
  if (!analysis) throw new Error(`no analyses for ${model}`);
  const vars = await getJson(`${base}/${model}/${analysis}/variables.json`);
  const varIds = ids(vars, "variables");
  if (!varIds.length) throw new Error(`no variables for ${model}`);

  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  let resolutionMeters = null;
  for (const v of varIds) {
    let manifest;
    try {
      manifest = await getJson(`${base}/${model}/${analysis}/${v}/manifest.json`);
    } catch {
      continue; // skip a variable with no manifest
    }
    const b = manifest.bounds;
    if (Array.isArray(b) && b.length === 4) {
      west = Math.min(west, b[0]);
      south = Math.min(south, b[1]);
      east = Math.max(east, b[2]);
      north = Math.max(north, b[3]);
    }
    const r = manifest?.rendering?.resolutionMeters;
    if (typeof r === "number" && r > 0) resolutionMeters = Math.min(resolutionMeters ?? r, r);
  }
  if (!Number.isFinite(west)) throw new Error(`no bounds found for ${model}`);
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    bbox: { west: round(west), south: round(south), east: round(east), north: round(north) },
    resolution_km:
      (resolutionMeters ?? RESOLUTION_METERS[model] ?? null) &&
      Math.round(((resolutionMeters ?? RESOLUTION_METERS[model]) / 1000) * 10) / 10,
  };
}

const current = await getJson(`${base}/models.json`);
if (!Array.isArray(current.models)) {
  console.error("models.json has no `models` array");
  process.exit(1);
}
for (const m of current.models) {
  try {
    const { bbox, resolution_km } = await modelBBox(m.id);
    m.resolution_km = resolution_km;
    m.bbox = bbox;
    console.error(`✓ ${m.id}: ${JSON.stringify(bbox)} @ ${resolution_km}km`);
  } catch (e) {
    console.error(`✗ ${m.id}: ${e.message} (left without bbox)`);
  }
}
process.stdout.write(JSON.stringify(current, null, 2) + "\n");
