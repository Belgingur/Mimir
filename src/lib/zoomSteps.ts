/**
 * Zoom-dependent step/density/downsample functions.
 *
 * All functions are pure: zoom → numeric result.
 * Used to adapt rendering detail to the current map zoom level.
 */

/** Grid line spacing in degrees for a given zoom level. */
export const getGridStepForZoom = (zoom: number) => {
  if (zoom >= 6) return 2;
  if (zoom >= 4.5) return 5;
  if (zoom >= 3.5) return 10;
  if (zoom >= 2.5) return 20;
  return 30;
};

/** Wave contour downsample factor. */
export const getWaveContourDownsample = (zoom: number) => {
  if (zoom >= 5) return 3;
  if (zoom >= 4) return 4;
  if (zoom >= 3) return 6;
  if (zoom >= 2) return 8;
  return 12;
};

/** MSLP contour downsample factor. */
export const getMslpContourDownsample = (zoom: number) => {
  if (zoom >= 5) return 2;
  if (zoom >= 4) return 3;
  if (zoom >= 3) return 4;
  if (zoom >= 2) return 6;
  return 8;
};

/** In-house contour downsample factor. */
export const getInhouseContourDownsample = (zoom: number) => {
  if (zoom < 2) return 6;
  if (zoom < 4) return 4;
  if (zoom < 6) return 3;
  if (zoom < 8) return 2;
  return 1;
};

/** Wind line step in pixels for a given zoom level. */
export const getWindStepForZoom = (zoom: number) => {
  if (zoom >= 6) return 1;
  if (zoom >= 5) return 2;
  if (zoom >= 4) return 3;
  if (zoom >= 3) return 4;
  return 6;
};

/** Arrow density multiplier for a given zoom level. */
export const getArrowDensityForZoom = (zoom: number) => {
  if (zoom >= 6) return 0.9;
  if (zoom >= 5) return 0.7;
  if (zoom >= 4) return 0.5;
  if (zoom >= 3) return 0.35;
  return 0.25;
};

/** Base arrow step (pixel spacing) for a given zoom level. */
export const getArrowStepForZoom = (zoom: number) => {
  if (zoom >= 6) return 6;
  if (zoom >= 5) return 8;
  if (zoom >= 4) return 10;
  if (zoom >= 3) return 12;
  return 16;
};

/** Arrow step adjusted for model resolution (e.g. UWC models need sparser arrows). */
export const getArrowStepForModel = (model: string | null, zoom: number) => {
  const base = getArrowStepForZoom(zoom);
  if (!model) return base;
  const upper = model.toUpperCase();
  if (upper.startsWith("UWC-")) {
    if (zoom <= 4.5) return Math.max(base, 40);
    if (zoom <= 5.5) return Math.max(base, 30);
    if (zoom <= 6.5) return Math.max(base, 20);
    if (zoom <= 7.5) return Math.max(base, 12);
    return Math.max(base, 8);
  }
  return base;
};

/** Wave period label step in degrees. */
export const getWaveLabelStepForZoom = (zoom: number) => {
  if (zoom >= 6) return 3;
  if (zoom >= 5) return 4;
  if (zoom >= 4) return 5;
  if (zoom >= 3) return 6;
  if (zoom >= 2) return 9;
  return 12;
};

/** Wind speed label step in pixels. */
export const getWindLabelStepForZoom = (zoom: number) => {
  if (zoom >= 7) return 10;
  if (zoom >= 6) return 12;
  if (zoom >= 5) return 16;
  if (zoom >= 4) return 20;
  if (zoom >= 3) return 28;
  return 40;
};

/** Composite wind overlay style (arrow step, label step, sizes) for a model at a given zoom. */
export const getWindOverlayStyle = (model: string | null, zoom: number) => {
  const arrowStep = Math.max(
    1,
    Math.round(getArrowStepForModel(model, zoom) * 1.5),
  );
  const labelStepBase = getWindLabelStepForZoom(zoom);
  const labelStep =
    model && model.toUpperCase() === "UWC-DINI"
      ? Math.max(labelStepBase, 48)
      : model && model.toUpperCase().startsWith("UWC-")
        ? Math.max(labelStepBase, 24)
        : labelStepBase;
  const arrowSizeMin = zoom >= 6 ? 14 : zoom >= 4 ? 13 : 12;
  const arrowSizeMax = zoom >= 6 ? 24 : zoom >= 4 ? 22 : 20;
  const labelSize = zoom >= 6 ? 13 : zoom >= 4 ? 12 : 11;
  // Per-model anisotropic arrow density overrides.
  // stepX controls east-west spacing; stepY controls north-south spacing.
  // Smaller step = denser arrows (halving stepX doubles east-west density, etc.).
  let arrowStepX = arrowStep;
  let arrowStepY = arrowStep;
  if (model && model.toUpperCase() === "ECMWF-IS") {
    arrowStepX = Math.max(1, Math.round(arrowStep / 2)); // 2× east-west density
    arrowStepY = Math.max(1, Math.round(arrowStep / 4)); // 4× north-south density
  }
  return {
    arrowStep,
    arrowStepX,
    arrowStepY,
    labelStep,
    arrowMagnitudeMin: 2,
    arrowMagnitudeMax: 20,
    arrowSizeMin,
    arrowSizeMax,
    labelSize,
  };
};

/** Wind streamline rendering style (density, width, arrowSize) for a given zoom. */
export const getWindStreamlineStyle = (zoom: number) => {
  if (zoom < 3) return { density: 0.18, width: 1.1, arrowSize: 10 };
  if (zoom < 4) return { density: 0.24, width: 1.2, arrowSize: 11 };
  if (zoom < 5) return { density: 0.32, width: 1.3, arrowSize: 12 };
  if (zoom < 6) return { density: 0.42, width: 1.4, arrowSize: 13 };
  if (zoom < 7) return { density: 0.56, width: 1.5, arrowSize: 14 };
  return { density: 0.72, width: 1.6, arrowSize: 15 };
};

/**
 * Icon grid step in degrees for iconography mode at a given zoom level.
 * Controls how densely weather condition icons are placed on the map.
 * Returns { degStep, iconSize } where degStep is the lat/lon spacing between
 * icons (degrees) and iconSize is the rendered icon size (pixels).
 */
export const getIconGridForZoom = (
  zoom: number,
): { degStep: number; iconSize: number } => {
  if (zoom >= 9) return { degStep: 0.25, iconSize: 72 };
  if (zoom >= 8) return { degStep: 0.5, iconSize: 69 };
  if (zoom >= 7) return { degStep: 1.0, iconSize: 66 };
  if (zoom >= 6) return { degStep: 1.5, iconSize: 63 };
  if (zoom >= 5) return { degStep: 2.5, iconSize: 60 };
  if (zoom >= 4) return { degStep: 4.0, iconSize: 57 };
  if (zoom >= 3) return { degStep: 6.0, iconSize: 54 };
  if (zoom >= 2) return { degStep: 10.0, iconSize: 51 };
  return { degStep: 15.0, iconSize: 48 };
};
