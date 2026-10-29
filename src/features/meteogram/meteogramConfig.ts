import type { MeteogramRef } from "../../lib/inhouseTypes";

export function normalizeMeteogramModelId(modelId: string): string {
  return modelId.trim().toUpperCase();
}

/**
 * What the meteogram widget loads for a model: the WOD meteo config
 * (`client`) and, when that config lists several forecasts, which one.
 */
export interface MeteogramTarget {
  readonly client: string;
  readonly forecast?: string;
}

/**
 * The meteogram target for a model. A model whose catalog entry has a
 * `meteogram` field uses that config and forecast. Any other model, or one whose
 * forecast id is malformed, uses a config named after the model itself, whose
 * first forecast is shown; whether that config exists is up to the backend (a
 * 404 means it does not).
 */
export function resolveMeteogramTarget(
  modelId: string,
  ref?: MeteogramRef,
): MeteogramTarget {
  if (ref && forecastAttributes(ref.forecast)) {
    return { client: ref.client, forecast: ref.forecast };
  }
  return { client: normalizeMeteogramModelId(modelId) };
}

/** Equal for two targets that load the same forecast. */
export function meteogramTargetKey(target: MeteogramTarget): string {
  return target.forecast ? `${target.client} ${target.forecast}` : target.client;
}

/**
 * The widget attributes that pick a forecast out of its config:
 * `upstream/<name>` or `<type>/<name>/<domain>`, as in the config's forecast ids.
 * Returns null for an id of another shape.
 */
export function forecastAttributes(
  forecast: string,
): { type: string; name: string; domain?: string } | null {
  const [type, name, domain, ...rest] = forecast.split("/");
  if (!type || !name || rest.length) return null;
  if (type === "upstream") return domain === undefined ? { type, name } : null;
  return domain ? { type, name, domain } : null;
}
