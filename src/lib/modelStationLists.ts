/**
 * The station list each model's forecast points come from, for the click
 * resolver.
 *
 * A click on a city label snaps to the same-named station in the selected
 * model's station list (see snapToStation in resolveClickedPlace.ts). The
 * resolver used to read that list from the iconography, which loads it only
 * once the icons view has been opened, so in forecast view a name click
 * snapped or not depending on what the reader had opened before. This loads
 * the list with the model instead, whatever the view.
 *
 * Only a model's own station file counts. The iconography falls back to the
 * global cities file for a model without one, but snapping to that would only
 * move the pin to another dataset's guess at the city, with no station and no
 * corrected forecast behind it.
 */

import type { ExtraPlace } from "./nearestPlace";

/**
 * Models that take another model's station list. BEL-IS (EC) runs on the same
 * WOD station config as BEL-IS: checked 2026-11-06, both forecasts list the
 * same 153 stations by ref and WOD corrects the same 125 of them, so a click
 * snaps to the same stations and gets the same corrected forecast.
 */
export const STATION_LIST_FOR_MODEL: Readonly<Record<string, string>> = {
  "BEL-IS_EC": "BEL-IS",
};

/** The station file a model's list comes from. */
export function stationListUrl(model: string): string {
  return `/data/stations-${STATION_LIST_FOR_MODEL[model] ?? model}.json`;
}

/** `{ "cities": [[name, lon, lat, rank], ...] }`, as the iconography reads it. */
interface StationListPayload {
  readonly cities?: readonly (readonly [string, number, number, number?])[];
}

const NONE: readonly ExtraPlace[] = [];

/** Loads each model's station list once, and answers synchronously after. */
export class ModelStationLists {
  private readonly lists = new Map<string, readonly ExtraPlace[]>();
  private readonly loading = new Map<string, Promise<void>>();

  /**
   * The stations of `model`'s list, or none while it loads or when the model
   * has no list. Starts the load on first use, so a click right after a model
   * change can come before the list does; {@link preload} avoids that.
   */
  placesFor(model: string): readonly ExtraPlace[] {
    if (!model) return NONE;
    const url = stationListUrl(model);
    const list = this.lists.get(url);
    if (list) return list;
    void this.load(url);
    return NONE;
  }

  /** Start loading `model`'s list, if it isn't loaded or loading already. */
  preload(model: string): Promise<void> {
    return model ? this.load(stationListUrl(model)) : Promise.resolve();
  }

  private load(url: string): Promise<void> {
    if (this.lists.has(url)) return Promise.resolve();
    let pending = this.loading.get(url);
    if (!pending) {
      pending = fetchStations(url).then((list) => {
        this.lists.set(url, list);
        this.loading.delete(url);
      });
      this.loading.set(url, pending);
    }
    return pending;
  }
}

/**
 * A station file's places, or none when the model has no file. Most models
 * don't, and a server may answer a missing file with its HTML page, so a 404
 * or anything that isn't a station list counts as no list rather than an error.
 */
async function fetchStations(url: string): Promise<readonly ExtraPlace[]> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return NONE;
    const payload = (await resp.json()) as StationListPayload;
    if (!Array.isArray(payload.cities)) return NONE;
    return payload.cities
      .filter(
        ([name, lon, lat]) =>
          typeof name === "string" && Number.isFinite(lon) && Number.isFinite(lat),
      )
      .map(([name, lon, lat]) => ({ name, lon, lat }));
  } catch {
    return NONE;
  }
}
