/**
 * What the reader is told when the forecast's frame didn't load: after a
 * model, layer or run switch, a step on the timeline, or the first load.
 *
 * A frame's request can fail, or be given up because nothing arrived (see
 * fetchFrame). The loader then ends with an error and a Retry action, not
 * with a map that silently shows something else than the controls say. Retry
 * loads the same frames again.
 */
import type { DatasetLoadingOverlay } from "./datasetLoadingOverlay";

export interface FrameLoadNoticeDeps {
  overlay: Pick<DatasetLoadingOverlay, "begin" | "end" | "fail" | "isLatest">;
  /** Loads the frames for the selected time again. Resolves when that load
   *  has ended, either way. */
  reloadFrames: () => Promise<void>;
  errorText: () => string;
  retryLabel: () => string;
  retryingText: () => string;
}

export interface FrameLoadNotice {
  /**
   * Told how each frame load ended (see
   * InhouseCatalogDeps.onFrameSetLoadEnded). The error shows if it failed. If
   * it didn't, an error left by an earlier load goes; a loader shown since
   * stays, for the load that showed it to end.
   */
  frameLoadEnded(failed: boolean): void;
  /**
   * Ends a load that showed the loader and waited for its frames: the loader
   * goes, or the error stays in its place. With the loader's ticket, only
   * when that load is still the latest; a newer one ends for itself.
   */
  loadEnded(ticket?: number): void;
  /** Whether the last frame load that ended did so without its frame. A load
   *  still under way doesn't count until it ends. */
  framesFailed(): boolean;
}

export function createFrameLoadNotice(
  deps: FrameLoadNoticeDeps,
): FrameLoadNotice {
  const { overlay } = deps;
  let failed = false;
  let errorTicket: number | undefined;

  const retry = async (): Promise<void> => {
    const ticket = overlay.begin(deps.retryingText());
    await deps.reloadFrames();
    loadEnded(ticket);
  };

  const showError = (): void => {
    errorTicket = overlay.fail({
      message: deps.errorText(),
      backLabel: deps.retryLabel(),
      onBack: () => void retry(),
    });
  };

  const clearError = (): void => {
    if (errorTicket === undefined) return;
    // By its ticket: a loader that has replaced the error is left alone.
    overlay.end(errorTicket);
    errorTicket = undefined;
  };

  function loadEnded(ticket?: number): void {
    if (ticket !== undefined && !overlay.isLatest(ticket)) return;
    if (failed) showError();
    else overlay.end(ticket);
  }

  return {
    frameLoadEnded(loadFailed: boolean): void {
      failed = loadFailed;
      if (failed) showError();
      else clearError();
    },
    loadEnded,
    framesFailed: () => failed,
  };
}
