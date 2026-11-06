/**
 * Extra filters on the basemap's town and village labels, layered over the
 * style's own.
 *
 * Mímir names cities from its own dataset (cityLabelLayer.ts) and hides the
 * basemap's city layers so nothing is named twice. But the basemap classes
 * many of those places as *towns*, and its town layer stays on for the small
 * places the dataset lacks — so Keflavík, Höfn, Selfoss and others were named
 * twice, the basemap's copy a kilometre or more from Mímir's. This hides a
 * basemap town or village label when Mímir's dataset has a city of the same
 * name within {@link DUPLICATE_RADIUS_M}. The radius, not the name alone, is
 * what keeps London, Ontario from being hidden for London, England.
 *
 * It also hides the label of the place the meteogram pin names, while the pin
 * is shown: the pin carries the name itself (see pinnedPlaceLabels.ts).
 *
 * MapTiler's positron writes these filters in the legacy syntax, and MapLibre
 * cannot mix legacy and expression syntax in one filter (a mixed `all` is read
 * as an expression, so the legacy terms quietly stop matching). The style's
 * own filter is therefore converted to an expression before ours is added.
 * It is captured once per style layer object, so a reloaded style starts from
 * its own filters again and the extra terms are re-applied on top.
 */

import type * as maplibregl from "maplibre-gl";
import type { PlaceTuple } from "./nearestPlace";

/** Basemap layers a duplicate (or pinned) settlement label is hidden from. */
export const FILTERED_SETTLEMENT_LAYER_IDS = [
  "place_town",
  "place_village",
] as const;

/**
 * A basemap label this close to a Mímir city of the same name is that city.
 * The widest gap measured in Iceland is Borgarnes, 4.5 km; 10 km leaves room
 * for coarser Natural Earth points elsewhere without reaching the next town.
 */
export const DUPLICATE_RADIUS_M = 10_000;

/** The property the basemap draws (its text-field is "{name:latin}\n{name:nonlatin}"). */
const DRAWN_NAME = "name:latin";

type Filter = unknown;

// ─── Legacy filters → expressions ────────────────────────────────────────────

type Syntax = "expression" | "legacy" | "neutral";

/**
 * Which syntax a filter is written in, by MapLibre's own rule: one node that
 * only an expression can be decides the whole tree; otherwise any legacy-only
 * node makes it legacy. Bare booleans and `["has", key]` read the same either way.
 */
function syntaxOf(filter: Filter): Syntax {
  if (typeof filter === "boolean") return "neutral";
  if (!Array.isArray(filter) || filter.length === 0) return "legacy";
  switch (filter[0]) {
    case "has":
      if (filter.length < 2 || filter[1] === "$id" || filter[1] === "$type") {
        return "legacy";
      }
      return filter.length === 2 ? "neutral" : "expression";
    case "in":
      return filter.length >= 3 &&
        (typeof filter[1] !== "string" || Array.isArray(filter[2]))
        ? "expression"
        : "legacy";
    case "!in":
    case "!has":
    case "none":
      return "legacy";
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return filter.length !== 3 ||
        Array.isArray(filter[1]) ||
        Array.isArray(filter[2])
        ? "expression"
        : "legacy";
    case "any":
    case "all": {
      let legacy = false;
      for (const child of filter.slice(1)) {
        const syntax = syntaxOf(child);
        if (syntax === "expression") return "expression";
        if (syntax === "legacy") legacy = true;
      }
      return legacy ? "legacy" : "neutral";
    }
    default:
      return "expression";
  }
}

function propertyExpression(key: string): unknown[] {
  if (key === "$type") return ["geometry-type"];
  if (key === "$id") return ["id"];
  return ["get", key];
}

/** A legacy comparison: true only when the property has the value's type. */
function convertComparison(op: string, key: string, value: unknown): Filter {
  const property = propertyExpression(key);
  if (key !== "$type" && key !== "$id" && value === null) {
    // Legacy: a missing property is neither equal nor unequal to null.
    return op === "=="
      ? ["all", ["has", key], ["==", property, null]]
      : op === "!="
        ? ["any", ["!", ["has", key]], ["!=", property, null]]
        : false;
  }
  if (op === "==" || op === "!=" || key === "$type") {
    // Expression equality across types is simply false, as in legacy.
    return [op, property, value];
  }
  // Ordering throws on a type mismatch in an expression, where legacy said
  // false; the guard keeps the legacy answer.
  return ["all", ["==", ["typeof", property], typeof value], [op, property, value]];
}

function convertIn(key: string, values: unknown[], negate: boolean): Filter {
  if (values.length === 0) return negate;
  const property = propertyExpression(key);
  const type = typeof values[0];
  const uniform =
    (type === "string" || type === "number") &&
    values.every((v) => typeof v === type);
  if (uniform) {
    const unique = [...new Set(values)].sort();
    return ["match", property, unique, !negate, negate];
  }
  return negate
    ? ["all", ...values.map((v) => ["!=", property, v])]
    : ["any", ...values.map((v) => ["==", property, v])];
}

function convertHas(key: string): Filter {
  if (key === "$type") return true;
  if (key === "$id") return ["!=", ["id"], null];
  return ["has", key];
}

function convertLegacy(filter: Filter): Filter {
  if (!Array.isArray(filter)) return true;
  const [op, ...args] = filter as [string, ...unknown[]];
  if (filter.length <= 1) return op !== "any";
  switch (op) {
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return convertComparison(op, args[0] as string, args[1]);
    case "all":
    case "any": {
      const children = args.map((child) =>
        syntaxOf(child) === "legacy" ? convertLegacy(child) : child,
      );
      return children.length === 1 ? children[0] : [op, ...children];
    }
    case "none":
      return ["!", convertLegacy(["any", ...args])];
    case "in":
      return convertIn(args[0] as string, args.slice(1), false);
    case "!in":
      return convertIn(args[0] as string, args.slice(1), true);
    case "has":
      return convertHas(args[0] as string);
    case "!has":
      return ["!", convertHas(args[0] as string)];
    default:
      return true;
  }
}

/**
 * A layer filter as an expression, so expression terms can be added to it.
 * Expression and neutral filters are returned as they are; a missing filter
 * is `true`.
 */
export function toExpressionFilter(filter: Filter): Filter {
  if (filter === undefined || filter === null) return true;
  return syntaxOf(filter) === "legacy" ? convertLegacy(filter) : filter;
}

// ─── Duplicates of Mímir's cities ────────────────────────────────────────────

const duplicateFilters = new WeakMap<readonly PlaceTuple[], Filter | null>();

/**
 * Keep a basemap label unless a Mímir city of the same drawn name lies within
 * {@link DUPLICATE_RADIUS_M}. A `match` on the name finds the candidates in
 * one lookup, so the distance is only measured for the rare label that shares
 * a city's name, and never against the whole dataset.
 */
export function buildDuplicateCityFilter(
  places: readonly PlaceTuple[],
): Filter | null {
  if (duplicateFilters.has(places)) return duplicateFilters.get(places) ?? null;
  const byName = new Map<string, [number, number][]>();
  for (const [name, lon, lat] of places) {
    if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const points = byName.get(name);
    if (points) points.push([lon, lat]);
    else byName.set(name, [[lon, lat]]);
  }
  let filter: Filter | null = null;
  if (byName.size > 0) {
    const branches: unknown[] = [];
    for (const [name, points] of byName) {
      const geometry =
        points.length === 1
          ? { type: "Point", coordinates: points[0] }
          : { type: "MultiPoint", coordinates: points };
      branches.push(name, ["<=", ["distance", geometry], DUPLICATE_RADIUS_M]);
    }
    // A label without the property falls through to `false`, i.e. stays.
    filter = ["!", ["match", ["get", DRAWN_NAME], ...branches, false]];
  }
  duplicateFilters.set(places, filter);
  return filter;
}

// ─── The pinned place ────────────────────────────────────────────────────────

/** A place the meteogram pin names, at the pin's point. */
export interface PinnedSettlement {
  readonly name: string;
  readonly lng: number;
  readonly lat: number;
}

/** Compares names the way the click path does: ignoring case and accents. */
const SAME_NAME = [
  "collator",
  { "case-sensitive": false, "diacritic-sensitive": false },
];

/**
 * Hide basemap labels named like the pin, within `radiusM` of it. The pin's
 * name can come from any of `nameKeys` (a click takes the app locale's
 * `name:xx` first), so each is compared. `to-string` keeps a label without the
 * property from failing the comparison, which would hide it.
 */
export function buildPinnedSettlementFilter(
  pin: PinnedSettlement,
  radiusM: number,
  nameKeys: readonly string[],
): Filter {
  return [
    "!",
    [
      "all",
      [
        "any",
        ...nameKeys.map((key) => [
          "==",
          ["to-string", ["get", key]],
          pin.name,
          SAME_NAME,
        ]),
      ],
      [
        "<=",
        ["distance", { type: "Point", coordinates: [pin.lng, pin.lat] }],
        radiusM,
      ],
    ],
  ];
}

// ─── Applying the filters ────────────────────────────────────────────────────

interface FilterState {
  /** Hide basemap duplicates of Mímir's cities, or null to show them. */
  duplicates: Filter | null;
  /** Hide the pinned place's label, or null when nothing is pinned. */
  pinned: Filter | null;
}

const states = new WeakMap<maplibregl.Map, FilterState>();

/** The style's own filter for each style layer object, as authored and as an expression. */
const styleFilters = new WeakMap<object, { raw: Filter; expression: Filter }>();

/** What was last applied to each style layer object, to skip no-op updates. */
const applied = new WeakMap<object, FilterState>();

function stateOf(map: maplibregl.Map): FilterState {
  let state = states.get(map);
  if (!state) {
    state = { duplicates: null, pinned: null };
    states.set(map, state);
  }
  return state;
}

/**
 * Put the current extra terms on every filtered layer present in the style.
 * Cheap to call on every `styledata`: a layer whose terms haven't changed is
 * left alone, and a layer from a newly loaded style is picked up afresh.
 */
export function refreshSettlementLabelFilters(map: maplibregl.Map): void {
  const state = stateOf(map);
  for (const id of FILTERED_SETTLEMENT_LAYER_IDS) {
    let layer: object | undefined;
    try {
      layer = map.getLayer(id);
    } catch {
      continue; // style mid-swap; the next styledata retries
    }
    if (!layer) continue;

    let own = styleFilters.get(layer);
    if (!own) {
      // First sight of this layer object: its filter is still the style's.
      const raw = map.getFilter(id) as Filter;
      own = { raw, expression: toExpressionFilter(raw) };
      styleFilters.set(layer, own);
    }
    const last = applied.get(layer);
    if (
      last &&
      last.duplicates === state.duplicates &&
      last.pinned === state.pinned
    ) {
      continue;
    }

    const extra = [state.duplicates, state.pinned].filter(
      (term) => term !== null,
    );
    const next =
      extra.length === 0
        ? own.raw // restore exactly what the style had
        : ["all", own.expression, ...extra];
    try {
      map.setFilter(id, next as maplibregl.FilterSpecification);
    } catch {
      // The style is still loading. Not recorded as applied, so the next
      // styledata (or settled-style retry) tries again.
      continue;
    }
    applied.set(layer, { ...state });
  }
}

/**
 * Hide basemap labels that repeat a city from `places` (Mímir's city layer),
 * or pass null to show them all again — as when Mímir's city layer is absent
 * and the basemap's labels are all there is.
 */
export function setCityDuplicates(
  map: maplibregl.Map,
  places: readonly PlaceTuple[] | null,
): void {
  const state = stateOf(map);
  const next = places ? buildDuplicateCityFilter(places) : null;
  if (state.duplicates === next) {
    refreshSettlementLabelFilters(map);
    return;
  }
  state.duplicates = next;
  refreshSettlementLabelFilters(map);
}

/** The pin each map's `pinned` term was built for, to skip rebuilding it. */
const pinnedFor = new WeakMap<maplibregl.Map, PinnedSettlement | null>();

/**
 * Hide the basemap label of the place the pin names (see
 * {@link buildPinnedSettlementFilter}), or pass null to show it again. A pin
 * re-shown at the same place leaves the layers alone.
 */
export function setPinnedSettlement(
  map: maplibregl.Map,
  pin: PinnedSettlement | null,
  radiusM: number,
  nameKeys: readonly string[],
): void {
  const previous = pinnedFor.get(map) ?? null;
  const same =
    previous === pin ||
    (previous !== null &&
      pin !== null &&
      previous.name === pin.name &&
      previous.lng === pin.lng &&
      previous.lat === pin.lat);
  if (same) return;
  pinnedFor.set(map, pin);
  stateOf(map).pinned = pin
    ? buildPinnedSettlementFilter(pin, radiusM, nameKeys)
    : null;
  refreshSettlementLabelFilters(map);
}
