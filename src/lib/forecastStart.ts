/**
 * The forecast's part of the first load, with a way to try it again.
 *
 * The start can fail: a catalog file or a manifest doesn't load, or times
 * out. The reader then gets an error with a Retry action instead of a page
 * with no forecast and no word about it. Retry loads the catalog again and
 * runs the same start.
 */
export interface ForecastStartDeps {
  /** Loads the first layers and builds the forecast's UI. Rejects, before it
   *  has built anything, when there is nothing to show. */
  initWeather: () => Promise<void>;
  /** Loads the catalog again: the models, the runs and the variables. */
  reloadCatalog: () => Promise<void>;
  /** Shows the error, with an action that calls `retry`. */
  showError: (retry: () => void) => void;
  /** Shows that a retry is under way, in place of the error. */
  showRetrying: () => void;
  /** Takes the error or the retry notice away: the forecast is in. */
  clear: () => void;
}

export interface ForecastStart {
  /** Runs the start. Resolves either way: true with the forecast in, false
   *  with the error on screen. */
  start(): Promise<boolean>;
}

export function createForecastStart(deps: ForecastStartDeps): ForecastStart {
  let running = false;

  const attempt = async (isRetry: boolean): Promise<boolean> => {
    // One attempt at a time: a second press of Retry joins nothing new.
    if (running) return false;
    running = true;
    try {
      if (isRetry) {
        deps.showRetrying();
        await deps.reloadCatalog();
      }
      await deps.initWeather();
      if (isRetry) deps.clear();
      return true;
    } catch (error) {
      console.error(error);
      deps.showError(() => void attempt(true));
      return false;
    } finally {
      running = false;
    }
  };

  return { start: () => attempt(false) };
}
