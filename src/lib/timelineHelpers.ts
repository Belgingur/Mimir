import { t } from "./i18n";

// Forecast timestamps travel as ISO 8601 UTC instants, but the timeline is read
// by a person standing in some particular place, so every label below is
// rendered through the browser's own zone (the local getters do the conversion
// for us). Nothing about the underlying instants changes — only how they read.

/** Translated short weekday from the active locale (keys day.0 … day.6). */
const weekday = (date: Date) => t(`day.${date.getDay()}`);

export const formatTimelineDayLabel = (datetime: string) => {
  const date = new Date(datetime);
  return `${weekday(date)} ${date.getDate()}`;
};

export const formatTimelineBubbleLabel = (datetime: string) => {
  const date = new Date(datetime);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${weekday(date)} ${date.getDate()} - ${hh}:${mm}`;
};

/**
 * Compact marker for the zone the labels above are drawn in — "UTC", "UTC-3",
 * "UTC+5:30". Derived from the offset of the given instant rather than of
 * "now", so a forecast that crosses a daylight-saving boundary is still
 * labelled with the offset actually in force at that step.
 *
 * Computed from getTimezoneOffset() instead of Intl's `timeZoneName` so the
 * output stays a fixed, translation-free shape the tiny timeline chrome can
 * budget space for.
 */
export const formatTimelineZoneLabel = (datetime: string) => {
  const date = new Date(datetime);
  // getTimezoneOffset() counts minutes to ADD to local time to reach UTC, i.e.
  // it runs backwards from how offsets are written — hence the negation.
  const offsetMinutes = -date.getTimezoneOffset();
  if (!Number.isFinite(offsetMinutes) || offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes < 0 ? "-" : "+";
  const total = Math.abs(offsetMinutes);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes
    ? `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`
    : `UTC${sign}${hours}`;
};

/**
 * Same reading as the rail tab, plus the zone marker. Used for the roomier
 * on-map bubble, where there is space to say which clock this is — without it
 * a viewer abroad has no way to tell local time from the UTC the data is
 * published in.
 */
export const formatTimelineBubbleLabelWithZone = (datetime: string) =>
  `${formatTimelineBubbleLabel(datetime)} ${formatTimelineZoneLabel(datetime)}`;

export const buildTimelineDayBlocks = (datetimes: string[]) => {
  const blocks: Array<{ label: string; start: number; end: number }> = [];
  for (let i = 0; i < datetimes.length; i += 1) {
    const label = formatTimelineDayLabel(datetimes[i]);
    const current = blocks[blocks.length - 1];
    if (current && current.label === label) {
      current.end = i;
    } else {
      blocks.push({ label, start: i, end: i });
    }
  }
  return blocks;
};

export const matchNearestTimeIndex = (times: string[], target: string) => {
  const targetMs = Date.parse(target);
  if (!Number.isFinite(targetMs)) return 0;
  let best = 0;
  let bestDiff = Infinity;
  times.forEach((t, idx) => {
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) return;
    const diff = Math.abs(ms - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = idx;
    }
  });
  return best;
};

export type DatetimeRange = {
  start?: string;
  end?: string;
  from?: string;
  to?: string;
} | null;

export const filterTimesByRange = (times: string[], range: DatetimeRange) => {
  if (!range) return times;
  const start = range.start ?? range.from;
  const end = range.end ?? range.to;
  if (!start || !end) return times;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return times;
  return times.filter((time) => {
    const ms = Date.parse(time);
    return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
  });
};
