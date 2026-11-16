/**
 * Runs work once the first load's start has ended, however it ended; at once
 * when it already has.
 *
 * For work that must wait for the map's opening view but not for the basemap:
 * MapLibre's `load` waits for every basemap request and fires once, so a tile
 * or sprite that never answered held such work back for good, and so did code
 * that arrived after `load` while tiles were loading, when `map.loaded()` is
 * false (#58, #66).
 */
export interface StartFinished {
  /** The start has ended: run what waits, once. */
  finish(): void;
  /** Run `fn` once the start has ended (now, if it has). */
  then(fn: () => void): void;
}

export function createStartFinished(): StartFinished {
  let done = false;
  let waiting: (() => void)[] = [];
  return {
    finish() {
      if (done) return;
      done = true;
      const run = waiting;
      waiting = [];
      for (const fn of run) fn();
    },
    then(fn) {
      if (done) fn();
      else waiting.push(fn);
    },
  };
}
