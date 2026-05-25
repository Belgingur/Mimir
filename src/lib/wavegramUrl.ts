export const buildSpreadWavegramUrl = (options: {
  baseUrl: string;
  upstream?: string;
  lat: number;
  lon: number;
  duration?: number;
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
    durationUnit = "hours",
    tz = "UTC",
    lang = "en",
    include = ["now", "tech"],
    imgFmt = "png",
  } = options;
  const latFixed = lat.toFixed(3);
  const lonFixed = lon.toFixed(3);
  const params = new URLSearchParams({ tz, lang });
  include.forEach((value) => params.append("include", value));
  return `${baseUrl}/api/v2/plot/point/upstream/${upstream}/latlon/${latFixed},${lonFixed}/duration/${duration}/${durationUnit}/spread_wavegram.${imgFmt}?${params.toString()}`;
};
