import { t } from "./i18n";

/** Translated short weekday from the active locale (keys day.0 … day.6). */
const weekday = (date: Date) => t(`day.${date.getUTCDay()}`);

export const formatTimelineDayLabel = (datetime: string) => {
  const date = new Date(datetime);
  return `${weekday(date)} ${date.getUTCDate()}`;
};

export const formatTimelineBubbleLabel = (datetime: string) => {
  const date = new Date(datetime);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${weekday(date)} ${date.getUTCDate()} - ${hh}:${mm}`;
};

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
