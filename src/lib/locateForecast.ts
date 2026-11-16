import type { UserLocation } from "./initialCamera";

/**
 * Where the location button opens the forecast by itself: a wide screen with
 * a fine pointer, where the docked panel leaves the map in view. On a phone
 * the panel would cover the map just moved to, so there the reader taps the
 * location dot instead (#84).
 */
export const LOCATE_OPENS_FORECAST_MEDIA =
  "(min-width: 900px) and (pointer: fine)";

export function locateOpensForecast(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(LOCATE_OPENS_FORECAST_MEDIA).matches;
}

export interface LocateForecastDeps {
  /** True where a fix from the button opens the panel by itself. */
  readonly opensByItself: () => boolean;
  /** True when a map click would open the panel now (the forecast view, a
   *  layer with a meteogram, the panel's code loaded). */
  readonly canOpen: () => boolean;
  /** Open the panel at the reader's position, named as their location. */
  readonly open: (loc: UserLocation) => void;
}

export interface LocateForecast {
  /** The map has finished moving to a fix the location button asked for. */
  located(loc: UserLocation): void;
  /** Make the location dot open the forecast at the position it shows. */
  bindDot(dot: HTMLElement, position: () => UserLocation | null): void;
}

export function createLocateForecast(deps: LocateForecastDeps): LocateForecast {
  const openAt = (loc: UserLocation | null): void => {
    if (loc && deps.canOpen()) deps.open(loc);
  };
  return {
    located(loc) {
      if (deps.opensByItself()) openAt(loc);
    },
    bindDot(dot, position) {
      dot.setAttribute("role", "button");
      dot.tabIndex = 0;
      // Only the click stops here: the map below would read it as a click of
      // its own and open the panel again at the pixel under the finger. A drag
      // that starts on the dot still pans the map.
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        openAt(position());
      });
      dot.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openAt(position());
      });
    },
  };
}
