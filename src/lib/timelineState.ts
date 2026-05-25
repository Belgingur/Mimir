export const clampSelectedIndex = (
  selectedIndex: number,
  datetimes: string[],
) => {
  if (!datetimes.length) return -1;
  if (!Number.isFinite(selectedIndex)) return 0;
  return Math.max(0, Math.min(datetimes.length - 1, Math.trunc(selectedIndex)));
};

export const resolveDatasetDatetime = (
  requested: string,
  datasetDatetimes: string[],
  baseTimeline: string[],
) => {
  if (!datasetDatetimes.length) return requested;
  if (datasetDatetimes.includes(requested)) return requested;
  if (!baseTimeline.length) return datasetDatetimes[0];
  const idx = baseTimeline.indexOf(requested);
  if (idx < 0) return datasetDatetimes[0];
  const maxIndex = Math.max(1, baseTimeline.length - 1);
  const mapped = Math.round((idx / maxIndex) * (datasetDatetimes.length - 1));
  return datasetDatetimes[
    Math.max(0, Math.min(datasetDatetimes.length - 1, mapped))
  ];
};

export const rebuildTimelineState = (input: {
  datetimes: string[];
  requestedDatetime?: string | null;
  previousTimeline?: string[];
  selectedIndex?: number | null;
}) => {
  const {
    datetimes,
    requestedDatetime,
    previousTimeline = [],
    selectedIndex = null,
  } = input;
  if (!datetimes.length) {
    return { datetimes: [], selectedDatetime: "", selectedIndex: -1 };
  }
  let nextDatetime = datetimes[0];
  if (requestedDatetime) {
    nextDatetime = resolveDatasetDatetime(
      requestedDatetime,
      datetimes,
      previousTimeline.length ? previousTimeline : datetimes,
    );
  } else if (selectedIndex !== null && Number.isFinite(selectedIndex)) {
    nextDatetime = datetimes[clampSelectedIndex(selectedIndex, datetimes)];
  }
  const nextIndex = clampSelectedIndex(
    datetimes.indexOf(nextDatetime),
    datetimes,
  );
  return {
    datetimes: datetimes.slice(),
    selectedDatetime: datetimes[nextIndex],
    selectedIndex: nextIndex,
  };
};
