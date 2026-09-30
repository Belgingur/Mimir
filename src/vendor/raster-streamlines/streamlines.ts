export type StreamlineOptions = {
  geotransform?: [number, number, number, number, number, number] | null;
  density?: number;
  flip?: boolean;
  minSpeed?: number;
};

export type StreamlineFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: { num_line: number };
  }>;
};

export const streamlines = (
  uData: number[][],
  vData: number[][],
  opts: StreamlineOptions = {},
): StreamlineFeatureCollection => {
  const geotransform = opts.geotransform ?? null;
  const density = opts.density ?? 1;
  const flip = opts.flip ?? false;
  const minS = opts.minSpeed ?? 0;
  const minS2 = minS * minS;

  if (geotransform && geotransform.length !== 6) {
    throw new Error("Bad geotransform");
  }

  const output: StreamlineFeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  let numLines = 0;
  const pixelDist = Math.round(uData.length / (60 * density)) || 1;
  const inst = new StreamlineTracer(uData, vData, pixelDist);
  const total = inst.xSize * inst.ySize;

  for (let pos = 0; pos < total; pos += 1) {
    const n = (pos * 327685) % total;
    const x = Math.trunc(n / inst.ySize);
    const y = n % inst.ySize;
    if (!inst.isPixelFree(x, y, pixelDist)) continue;
    const line = inst.getLine(x, y, flip, minS2);
    if (!line) continue;
    output.features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: inst.applyGeoTransform(line, geotransform),
      },
      properties: { num_line: numLines },
    });
    numLines += 1;
  }

  return output;
};

class StreamlineTracer {
  uData: number[][];
  vData: number[][];
  xSize: number;
  ySize: number;
  usedPixels: boolean[][];
  // Pixels within `dist` (per axis) of a used pixel. isPixelFree asks "is any
  // pixel within dist used?"; scanning that (2·dist+1)² box for every seed was
  // the whole cost on large grids (dist is ~65 px on a zoomed-out ICON-EU
  // grid). The box test is symmetric, so stamping each used pixel's box into
  // this mask gives the same answers with an O(1) lookup.
  dist: number;
  blocked: Uint8Array;

  constructor(uData: number[][], vData: number[][], dist = 1) {
    if (
      uData.length <= 1 ||
      vData.length <= 1 ||
      uData[0].length <= 1 ||
      vData[0].length <= 1
    ) {
      throw new Error("Raster is too small");
    }
    if (uData.length !== vData.length || uData[0].length !== vData[0].length) {
      throw new Error("Raster components are not the same shape");
    }
    this.uData = uData;
    this.vData = vData;
    this.xSize = uData[0].length;
    this.ySize = uData.length;
    this.usedPixels = new Array(this.ySize);
    for (let y = 0; y < this.ySize; y += 1) {
      this.usedPixels[y] = new Array(this.xSize).fill(false);
    }
    this.dist = Math.max(0, Math.round(dist));
    this.blocked = new Uint8Array(this.xSize * this.ySize);
  }

  markUsed(x: number, y: number) {
    if (this.usedPixels[y][x]) return;
    this.usedPixels[y][x] = true;
    const d = this.dist;
    const xLow = Math.max(x - d, 0);
    const xEnd = Math.min(x + d, this.xSize - 1) + 1;
    const yHigh = Math.min(y + d, this.ySize - 1);
    for (let yy = Math.max(y - d, 0); yy <= yHigh; yy += 1) {
      const row = yy * this.xSize;
      this.blocked.fill(1, row + xLow, row + xEnd);
    }
  }

  isPixelFree(x0: number, y0: number, dist: number) {
    if (x0 < 0 || x0 >= this.xSize || y0 < 0 || y0 >= this.ySize) return false;
    // Outside the model domain — NaN marks out-of-domain pixels.
    if (!Number.isFinite(this.uData[y0]?.[x0] ?? NaN)) return false;
    if (dist !== this.dist) {
      throw new Error("isPixelFree: dist differs from the tracer's");
    }
    return this.blocked[y0 * this.xSize + x0] === 0;
  }

  getLine(x0: number, y0: number, flip: boolean, minS2: number) {
    if (
      x0 < 0 ||
      y0 < 0 ||
      x0 >= this.xSize ||
      y0 >= this.ySize ||
      this.usedPixels[y0][x0]
    )
      return false;

    let lineFound = false;
    const outLine: [number, number][] = [[x0, y0]];
    const flipFactor = flip ? 1 : -1;

    let x = x0;
    let y = y0;
    while (true) {
      const values = this.getValueAtPoint(x, y);
      if (values.s2 <= minS2) {
        this.markUsed(x0, y0);
        break;
      }
      x += values.u;
      y += flipFactor * values.v;
      const xr = Math.round(x);
      const yr = Math.round(y);
      if (
        xr < 0 ||
        yr < 0 ||
        xr >= this.xSize ||
        yr >= this.ySize ||
        this.usedPixels[yr][xr]
      )
        break;
      outLine.push([x, y]);
      lineFound = true;
      this.markUsed(xr, yr);
    }

    x = x0;
    y = y0;
    while (true) {
      const values = this.getValueAtPoint(x, y);
      if (values.s2 <= minS2) {
        this.markUsed(x0, y0);
        break;
      }
      x -= values.u;
      y -= flipFactor * values.v;
      const xr = Math.round(x);
      const yr = Math.round(y);
      if (
        xr < 0 ||
        yr < 0 ||
        xr >= this.xSize ||
        yr >= this.ySize ||
        this.usedPixels[yr][xr]
      )
        break;
      outLine.unshift([x, y]);
      lineFound = true;
      this.markUsed(xr, yr);
    }

    if (!lineFound) return false;
    this.markUsed(x0, y0);
    return outLine;
  }

  applyGeoTransform(
    line: [number, number][],
    geotransform: StreamlineOptions["geotransform"],
  ) {
    if (geotransform == null) return line;
    return line.map((p) => [
      geotransform[0] + geotransform[1] * p[0] + geotransform[2] * p[1],
      geotransform[3] + geotransform[4] * p[0] + geotransform[5] * p[1],
    ]) as [number, number][];
  }

  getValueAtPoint(x: number, y: number) {
    const x0 = clamp(Math.floor(x), 0, this.xSize - 2);
    const x1 = x0 + 1;
    const y0 = clamp(Math.floor(y), 0, this.ySize - 2);
    const y1 = y0 + 1;

    const xw1 = x - x0;
    const xw0 = 1 - xw1;
    const yw1 = y - y0;
    const yw0 = 1 - yw1;

    const pw00 = yw0 * xw0;
    const pw01 = yw0 * xw1;
    const pw10 = yw1 * xw0;
    const pw11 = yw1 * xw1;

    // If any corner is outside the model domain (NaN), stop the line here.
    const u00 = this.uData[y0][x0];
    const u01 = this.uData[y0][x1];
    const u10 = this.uData[y1][x0];
    const u11 = this.uData[y1][x1];
    if (
      !Number.isFinite(u00) ||
      !Number.isFinite(u01) ||
      !Number.isFinite(u10) ||
      !Number.isFinite(u11)
    ) {
      return { u: 0, v: 0, s2: 0 };
    }

    const u = u00 * pw00 + u01 * pw01 + u10 * pw10 + u11 * pw11;
    const v =
      this.vData[y0][x0] * pw00 +
      this.vData[y0][x1] * pw01 +
      this.vData[y1][x0] * pw10 +
      this.vData[y1][x1] * pw11;

    const s2 = u * u + v * v;
    const mdl = Math.max(Math.abs(u), Math.abs(v)) || 1;
    return { u: u / mdl, v: v / mdl, s2 };
  }
}

const clamp = (value: number, min: number, max: number) =>
  value <= min ? min : value >= max ? max : value;
