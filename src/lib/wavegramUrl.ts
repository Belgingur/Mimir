/**
 * URL for a spread-wavegram plot.
 *
 * The duration is a QUERY PARAMETER (`?duration=120h`), not a pair of path
 * segments. The API used to take `/duration/{n}/{unit}/` before the plot
 * filename and now answers 404 for that shape, which is why the wavegram
 * stopped rendering for every point rather than just some of them — the failure
 * looked like missing data because the modal reports a failed image the same way
 * whatever the cause.
 *
 * The unit travels with the number (`120h`) instead of as its own segment, so
 * `durationUnit` is a suffix rather than a path component.
 */
export const buildSpreadWavegramUrl = (options: {
  baseUrl: string;
  upstream?: string;
  lat: number;
  lon: number;
  duration?: number;
  /** Unit suffix appended to the duration, e.g. "h" in `duration=120h`. */
  durationUnit?: string;
  tz?: string;
  lang?: string;
  include?: string[];
  imgFmt?: string;
}) => {
  const {
    baseUrl,
    upstream = "gwes",
    lat,
    lon,
    duration = 120,
    durationUnit = "h",
    tz = "UTC",
    lang = "en",
    include = ["now", "tech"],
    imgFmt = "png",
  } = options;
  const latFixed = lat.toFixed(3);
  const lonFixed = lon.toFixed(3);
  const params = new URLSearchParams({ tz, lang });
  include.forEach((value) => params.append("include", value));
  params.append("duration", `${duration}${durationUnit}`);
  return `${baseUrl}/api/v2/plot/point/upstream/${upstream}/latlon/${latFixed},${lonFixed}/spread_wavegram.${imgFmt}?${params.toString()}`;
};
