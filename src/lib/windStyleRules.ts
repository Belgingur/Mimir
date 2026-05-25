import type { WindStyle } from "./viewerTypes";

export const getWindStyleAvailability = (
  style: WindStyle,
  context: {
    hasWindUv10m: boolean;
    supportsWindParticlesPlatform: boolean;
    windParticlesRuntimeAvailable: boolean;
    isFirefox?: boolean;
  },
) => {
  const {
    hasWindUv10m,
    supportsWindParticlesPlatform,
    windParticlesRuntimeAvailable,
    isFirefox = false,
  } = context;
  if (style === "arrows") {
    return { enabled: true, hint: "Arrows" };
  }
  if (!hasWindUv10m) {
    return { enabled: false, hint: "Requires wind_uv_10m" };
  }
  if (style === "particles" && !supportsWindParticlesPlatform) {
    return {
      enabled: false,
      hint: isFirefox
        ? "Particles unsupported in Firefox"
        : "Particles require WebGL2",
    };
  }
  if (style === "particles" && !windParticlesRuntimeAvailable) {
    return { enabled: false, hint: "Particles unavailable" };
  }
  return {
    enabled: true,
    hint: style === "particles" ? "Particles" : "Streamlines",
  };
};

export const resolveWindStyleAfterContextChange = (
  currentStyle: WindStyle,
  context: {
    hasWindUv10m: boolean;
    supportsWindParticlesPlatform: boolean;
    windParticlesRuntimeAvailable: boolean;
    isFirefox?: boolean;
  },
) => {
  const availability = getWindStyleAvailability(currentStyle, context);
  if (availability.enabled) {
    return { style: currentStyle, warning: "" };
  }
  if (
    (currentStyle === "particles" || currentStyle === "streamlines") &&
    !context.hasWindUv10m
  ) {
    return {
      style: "arrows" as WindStyle,
      warning: "Particles and streamlines require wind_uv_10m.",
    };
  }
  if (currentStyle === "particles" && !context.supportsWindParticlesPlatform) {
    return {
      style: "arrows" as WindStyle,
      warning: context.isFirefox
        ? "Particle layer is not supported in Firefox; falling back to arrows."
        : "Particle layer unavailable; falling back to arrows.",
    };
  }
  if (currentStyle === "particles" && !context.windParticlesRuntimeAvailable) {
    return {
      style: "arrows" as WindStyle,
      warning: "Particle layer unavailable; falling back to arrows.",
    };
  }
  return { style: "arrows" as WindStyle, warning: "" };
};
