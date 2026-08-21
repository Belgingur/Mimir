/**
 * Decides when a map point may be shown under a place name.
 *
 * The rule is deliberately strict: a name is used only when the user actually
 * *selected* that city — i.e. clicked its label, so the resolver returned a
 * "label" result and the point was moved onto the city (or its station).
 *
 * A nearest-place result is not enough. Clicking open countryside 20 km from
 * Selfoss resolves "Selfoss" as the nearest place, but the forecast is for the
 * clicked spot, not for Selfoss — labelling it "Selfoss" while forecasting
 * somewhere else is exactly the mismatch this avoids. Those points fall back to
 * their raw coordinates.
 */

import type { ResolvedPlace } from "./resolveClickedPlace";

/** ~50 m: enough to match the same selection, not a different one. */
export const SAME_POINT_EPSILON_DEG = 0.0005;

export interface PlaceLabeller {
  /** Record the resolution for a clicked point. */
  remember(
    place: ResolvedPlace | null,
    lngLat: { lng: number; lat: number },
  ): void;
  /** Name for a point, or undefined when it should show coordinates instead. */
  labelAt(lng: number, lat: number): string | undefined;
}

export function createPlaceLabeller(): PlaceLabeller {
  let last: { place: ResolvedPlace | null; lng: number; lat: number } | null =
    null;

  return {
    remember(place, lngLat) {
      last = { place, lng: lngLat.lng, lat: lngLat.lat };
    },

    labelAt(lng, lat) {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
      const remembered = last;
      if (!remembered?.place) return undefined;
      if (remembered.place.source !== "label") return undefined;

      // Match against the *resolved* point, because that is the coordinate the
      // caller was handed and will be asking about — a label selection moves
      // the point onto the city, away from the raw click.
      const { place } = remembered;
      const matches =
        Math.abs(place.longitude - lng) < SAME_POINT_EPSILON_DEG &&
        Math.abs(place.latitude - lat) < SAME_POINT_EPSILON_DEG;
      return matches ? place.name : undefined;
    },
  };
}
