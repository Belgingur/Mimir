import { describe, it, expect } from "vitest";
import {
  getWindStyleAvailability,
  resolveWindStyleAfterContextChange,
} from "../src/lib/windStyleRules";

describe("getWindStyleAvailability", () => {
  const fullContext = {
    hasWindUv10m: true,
    supportsWindParticlesPlatform: true,
    windParticlesRuntimeAvailable: true,
    isFirefox: false,
  };

  it("arrows are always enabled regardless of context", () => {
    expect(
      getWindStyleAvailability("arrows", {
        hasWindUv10m: false,
        supportsWindParticlesPlatform: false,
        windParticlesRuntimeAvailable: false,
      }),
    ).toEqual({ enabled: true, hint: "Arrows" });
  });

  it("particles disabled without wind_uv_10m", () => {
    expect(
      getWindStyleAvailability("particles", {
        ...fullContext,
        hasWindUv10m: false,
      }),
    ).toEqual({ enabled: false, hint: "Requires wind_uv_10m" });
  });

  it("streamlines disabled without wind_uv_10m", () => {
    expect(
      getWindStyleAvailability("streamlines", {
        ...fullContext,
        hasWindUv10m: false,
      }),
    ).toEqual({ enabled: false, hint: "Requires wind_uv_10m" });
  });

  it("particles disabled without platform support", () => {
    expect(
      getWindStyleAvailability("particles", {
        ...fullContext,
        supportsWindParticlesPlatform: false,
      }),
    ).toEqual({ enabled: false, hint: "Particles require WebGL2" });
  });

  it("particles disabled on Firefox", () => {
    expect(
      getWindStyleAvailability("particles", {
        ...fullContext,
        supportsWindParticlesPlatform: false,
        isFirefox: true,
      }),
    ).toEqual({ enabled: false, hint: "Particles unsupported in Firefox" });
  });

  it("particles disabled without runtime availability", () => {
    expect(
      getWindStyleAvailability("particles", {
        ...fullContext,
        windParticlesRuntimeAvailable: false,
      }),
    ).toEqual({ enabled: false, hint: "Particles unavailable" });
  });

  it("particles enabled with full support", () => {
    expect(getWindStyleAvailability("particles", fullContext)).toEqual({
      enabled: true,
      hint: "Particles",
    });
  });

  it("streamlines enabled with wind_uv_10m", () => {
    expect(getWindStyleAvailability("streamlines", fullContext)).toEqual({
      enabled: true,
      hint: "Streamlines",
    });
  });
});

describe("resolveWindStyleAfterContextChange", () => {
  const fullContext = {
    hasWindUv10m: true,
    supportsWindParticlesPlatform: true,
    windParticlesRuntimeAvailable: true,
    isFirefox: false,
  };

  it("keeps style when available", () => {
    expect(
      resolveWindStyleAfterContextChange("particles", fullContext),
    ).toEqual({
      style: "particles",
      warning: "",
    });
  });

  it("falls back streamlines to arrows when no wind_uv_10m", () => {
    expect(
      resolveWindStyleAfterContextChange("streamlines", {
        ...fullContext,
        hasWindUv10m: false,
      }),
    ).toEqual({
      style: "arrows",
      warning: "Particles and streamlines require wind_uv_10m.",
    });
  });

  it("falls back particles to arrows when no wind_uv_10m", () => {
    expect(
      resolveWindStyleAfterContextChange("particles", {
        ...fullContext,
        hasWindUv10m: false,
      }),
    ).toEqual({
      style: "arrows",
      warning: "Particles and streamlines require wind_uv_10m.",
    });
  });

  it("falls back particles to arrows when platform unsupported", () => {
    expect(
      resolveWindStyleAfterContextChange("particles", {
        ...fullContext,
        supportsWindParticlesPlatform: false,
      }),
    ).toEqual({
      style: "arrows",
      warning: "Particle layer unavailable; falling back to arrows.",
    });
  });

  it("falls back particles to arrows on Firefox with specific message", () => {
    expect(
      resolveWindStyleAfterContextChange("particles", {
        ...fullContext,
        supportsWindParticlesPlatform: false,
        isFirefox: true,
      }),
    ).toEqual({
      style: "arrows",
      warning:
        "Particle layer is not supported in Firefox; falling back to arrows.",
    });
  });

  it("falls back particles to arrows when runtime unavailable", () => {
    expect(
      resolveWindStyleAfterContextChange("particles", {
        ...fullContext,
        windParticlesRuntimeAvailable: false,
      }),
    ).toEqual({
      style: "arrows",
      warning: "Particle layer unavailable; falling back to arrows.",
    });
  });

  it("keeps arrows with empty warning when already arrows", () => {
    expect(
      resolveWindStyleAfterContextChange("arrows", {
        hasWindUv10m: false,
        supportsWindParticlesPlatform: false,
        windParticlesRuntimeAvailable: false,
      }),
    ).toEqual({ style: "arrows", warning: "" });
  });
});
