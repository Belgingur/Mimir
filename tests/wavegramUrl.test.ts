import { describe, it, expect } from "vitest";
import { buildSpreadWavegramUrl } from "../src/lib/wavegramUrl";

describe("buildSpreadWavegramUrl", () => {
  const baseUrl = "https://wavegram.example";

  it("builds URL with required params only", () => {
    const url = buildSpreadWavegramUrl({ baseUrl, lat: 64.123, lon: -21.456 });
    expect(url).toContain("/api/v2/plot/point/upstream/gwes/");
    expect(url).toContain("/latlon/64.123,-21.456/");
    expect(url).toContain("/duration/120/hours/");
    expect(url).toContain("spread_wavegram.png");
    expect(url).toContain("tz=UTC");
    expect(url).toContain("lang=en");
    expect(url).toContain("include=now");
    expect(url).toContain("include=tech");
  });

  it("uses custom upstream", () => {
    const url = buildSpreadWavegramUrl({
      baseUrl,
      lat: 0,
      lon: 0,
      upstream: "custom",
    });
    expect(url).toContain("/upstream/custom/");
  });

  it("uses custom duration and durationUnit", () => {
    const url = buildSpreadWavegramUrl({
      baseUrl,
      lat: 0,
      lon: 0,
      duration: 48,
      durationUnit: "days",
    });
    expect(url).toContain("/duration/48/days/");
  });

  it("uses custom tz and lang", () => {
    const url = buildSpreadWavegramUrl({
      baseUrl,
      lat: 0,
      lon: 0,
      tz: "Europe/London",
      lang: "is",
    });
    expect(url).toContain("tz=Europe%2FLondon");
    expect(url).toContain("lang=is");
  });

  it("uses custom include array", () => {
    const url = buildSpreadWavegramUrl({
      baseUrl,
      lat: 0,
      lon: 0,
      include: ["now"],
    });
    expect(url).toContain("include=now");
    expect(url).not.toContain("include=tech");
  });

  it("uses custom image format", () => {
    const url = buildSpreadWavegramUrl({
      baseUrl,
      lat: 0,
      lon: 0,
      imgFmt: "svg",
    });
    expect(url).toContain("spread_wavegram.svg");
  });

  it("formats lat/lon to 3 decimal places", () => {
    const url = buildSpreadWavegramUrl({ baseUrl, lat: 64.1, lon: -21.4 });
    expect(url).toContain("/latlon/64.100,-21.400/");
  });

  it("starts with the provided baseUrl", () => {
    const url = buildSpreadWavegramUrl({
      baseUrl: "https://custom.api.com",
      lat: 0,
      lon: 0,
    });
    expect(url.startsWith("https://custom.api.com/")).toBe(true);
  });
});
