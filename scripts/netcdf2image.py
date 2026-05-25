#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import hashlib
import math
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr
from PIL import Image
import yaml

# Debug usage:
#   python scripts/netcdf2image.py --debug-one --variable air_temperature_at_2m_agl ...
#   python scripts/netcdf2image.py --debug --jobs 1 ...

WIND_U10_VAR = "U_true_at_10m_agl"
WIND_V10_VAR = "V_true_at_10m_agl"
WIND_UV10_DATASET = "wind_uv_10m"
FORECAST_DATA_SUBDIR = "forecast-data"
DEFAULT_DIRECTIONAL_VARIABLES = {
    "wind_from_direction_at_10m_agl",
}


def make_image(
    da: xr.DataArray,
    src_min: float,
    src_max: float,
    *,
    domain_mask: np.ndarray | None = None,
    image_scale: str | None = None,
) -> Image.Image:
    """Encode a scalar DataArray slice (2D) to a lossless WebP/PNG-like image.

    Encoding (matches WeatherLayers "Uint8 WebP scalar" convention):
      - value is quantized to Uint8 in the luminance channel (decoded as RGB with R=G=B=L)
      - nodata is stored as alpha=0 (valid pixels alpha=255)
      - Y axis is flipped (np.flipud) to match common raster conventions

    image_scale: optional non-linear transform applied before quantization.
      'log1p': encoded = log1p(value) / log1p(src_max) * 255
               Concentrates precision at low values; ~0.02 mm/hr resolution near zero.
               Assumes src_min == 0. Decoded client-side with expm1.
    """
    arr = da.values.astype(np.float32)
    mask = ~np.isfinite(arr)
    if domain_mask is not None:
        try:
            if domain_mask.shape == arr.shape:
                mask = mask | ~domain_mask
        except Exception:
            pass

    arr = np.nan_to_num(arr, nan=src_min)

    if image_scale == "log1p":
        log_max = np.log1p(src_max)
        if log_max == 0:
            raise ValueError("scale range invalid: log1p(src_max) == 0")
        scaled = np.log1p(np.clip(arr, 0.0, src_max)) / log_max * 255.0
    else:
        denom = src_max - src_min
        if denom == 0:
            raise ValueError("scale range invalid: min == max")
        scaled = (arr - src_min) / denom * 255.0

    img_data = np.clip(scaled, 0, 255).astype(np.uint8)
    if mask.any():
        img_data = img_data.copy()
        img_data[mask] = 0

    a = np.where(mask, 0, 255).astype(np.uint8)

    # Flip vertically so north is up when used with typical geospatial bounds
    img_data = np.flipud(img_data)
    a = np.flipud(a)

    return Image.fromarray(np.stack([img_data, a], axis=-1), mode="LA")


def make_vector_image(
    u_da: xr.DataArray,
    v_da: xr.DataArray,
    src_min: float,
    src_max: float,
) -> Image.Image:
    """Encode a vector field slice to RGBA with shared U/V scaling."""
    u = u_da.values.astype(np.float32)
    v = v_da.values.astype(np.float32)
    if u.shape != v.shape:
        raise ValueError(f"Vector component shape mismatch: {u.shape} vs {v.shape}")

    mask = ~np.isfinite(u) | ~np.isfinite(v)
    denom = src_max - src_min
    if denom == 0:
        raise ValueError("vector scale range invalid: min == max")

    u = np.nan_to_num(u, nan=src_min)
    v = np.nan_to_num(v, nan=src_min)
    u_q = np.clip((u - src_min) / denom * 255.0, 0, 255).astype(np.uint8)
    v_q = np.clip((v - src_min) / denom * 255.0, 0, 255).astype(np.uint8)
    if mask.any():
        u_q = u_q.copy()
        v_q = v_q.copy()
        u_q[mask] = 0
        v_q[mask] = 0

    b = np.zeros_like(u_q, dtype=np.uint8)
    a = np.where(mask, 0, 255).astype(np.uint8)

    rgba = np.stack([u_q, v_q, b, a], axis=-1)
    rgba = np.flipud(rgba)
    return Image.fromarray(rgba, mode="RGBA")


def normalize_degrees_360(arr: np.ndarray) -> np.ndarray:
    """Normalize degrees to the [0, 360) range."""
    return np.mod(np.mod(arr, 360.0) + 360.0, 360.0)


def is_directional_variable(var_name: str, da: xr.DataArray) -> bool:
    """Return True for angular direction variables that need circular regridding."""
    if var_name in DEFAULT_DIRECTIONAL_VARIABLES:
        return True

    attrs = da.attrs or {}
    standard_name = str(attrs.get("standard_name") or "").strip().lower()
    long_name = str(attrs.get("long_name") or attrs.get("description") or "").strip().lower()
    units = str(attrs.get("units") or "").strip().lower()

    if "wind_from_direction" in standard_name:
        return True
    if "wind from direction" in long_name and units in {"degree", "degrees", "deg"}:
        return True
    return False


def wind_from_dir_deg_to_uv(dir_deg: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Convert meteorological wind-from direction in degrees to unit flow vectors.

    Direction convention:
      - 0 deg = from north
      - 90 deg = from east

    The output (u, v) points toward the flow direction:
      - u > 0 eastward
      - v > 0 northward
    """
    theta = np.deg2rad(np.asarray(dir_deg, dtype=np.float32))
    u = -np.sin(theta)
    v = -np.cos(theta)
    invalid = ~np.isfinite(theta)
    if np.any(invalid):
        u = u.astype(np.float32, copy=True)
        v = v.astype(np.float32, copy=True)
        u[invalid] = np.nan
        v[invalid] = np.nan
    return u.astype(np.float32, copy=False), v.astype(np.float32, copy=False)


def uv_to_wind_from_dir_deg(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Convert flow vectors back to meteorological wind-from direction in [0, 360)."""
    u_arr = np.asarray(u, dtype=np.float32)
    v_arr = np.asarray(v, dtype=np.float32)
    direction = 270.0 - np.degrees(np.arctan2(v_arr, u_arr))
    direction = normalize_degrees_360(direction).astype(np.float32, copy=False)
    invalid = ~np.isfinite(u_arr) | ~np.isfinite(v_arr)
    if np.any(invalid):
        direction = direction.astype(np.float32, copy=True)
        direction[invalid] = np.nan
    return direction


def save_image(
    img: Image.Image, output_path: Path, fmt: str = "WEBP", *, verbose: bool = False
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # WEBP supports lossless. For PNG this will be ignored by Pillow.
    img.save(output_path, format=fmt, lossless=True, method=6)
    if verbose:
        print(f"Saved: {output_path}")


def parse_scale(s: str) -> tuple[float, float]:
    """Accepts formats like:
    "[-50,50]"
    "-50,50"
    "-50 50"
    """
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1].strip()
    parts = [p for p in s.replace(",", " ").split() if p]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(
            "scale must have exactly 2 numbers, e.g. '[-50,50]'"
        )
    lo, hi = map(float, parts)
    if lo == hi:
        raise argparse.ArgumentTypeError("scale invalid: min == max")
    return lo, hi


def parse_bounds(s: str) -> list[float]:
    """Parse bounds as [minLon,minLat,maxLon,maxLat]."""
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1].strip()
    parts = [p for p in s.replace(",", " ").split() if p]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError(
            "bounds must have 4 numbers, e.g. '[-180,-90,180,90]'"
        )
    vals = list(map(float, parts))
    min_lon, min_lat, max_lon, max_lat = vals
    if min_lon >= max_lon or min_lat >= max_lat:
        raise argparse.ArgumentTypeError(
            "bounds invalid: expected min < max for lon/lat"
        )
    return vals


def parse_shape(s: str) -> tuple[int, int]:
    s = s.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1].strip()
    parts = [p for p in s.replace(",", " ").split() if p]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("shape must be 'width,height' (e.g. 1440,721)")
    w, h = map(int, parts)
    if w <= 0 or h <= 0:
        raise argparse.ArgumentTypeError("shape values must be positive")
    return w, h


def parse_analysis_time(s: str) -> datetime:
    """Parse analysis time in the format YYYY-MM-DD_hh (UTC).

    Examples:
      2026-03-03_00
      2026-12-31_18
    """
    try:
        dt = datetime.strptime(s.strip(), "%Y-%m-%d_%H")
    except ValueError as e:
        raise argparse.ArgumentTypeError(
            "analysis must be in format YYYY-MM-DD_hh (e.g. 2026-03-03_00)"
        ) from e
    return dt.replace(tzinfo=timezone.utc)


def parse_positive_int(s: str) -> int:
    try:
        v = int(str(s).strip())
    except ValueError as e:
        raise argparse.ArgumentTypeError(f"expected integer, got: {s!r}") from e
    if v <= 0:
        raise argparse.ArgumentTypeError("value must be a positive integer")
    return v


def parse_analysis_time_guess(s: str) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d_%H", "%Y-%m-%d_%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _try_decode_wrf_times(times_var: xr.DataArray) -> list[str] | None:
    """Decode WRF-style 'Times' (char array) to ISO 8601 strings.

    Handles two representations that xarray may produce when opening WRF files:
    - ndim==2, dtype |S1 or <U1: classic (Time, DateStrLen) per-character layout
    - ndim==1, dtype |S<N>: xarray has collapsed DateStrLen into fixed-length byte
      strings (e.g. |S19 for 'YYYY-MM-DD_HH:MM:SS'), which is the common case with
      modern xarray/netCDF4 builds and was previously mishandled (returned None,
      causing the caller to fall back to generating uniform timestamps).
    """
    try:
        vals = times_var.values
    except Exception:
        return None

    if not hasattr(vals, "ndim"):
        return None

    raw_strings: list[str] = []

    if vals.ndim == 2:
        # Classic layout: (Time, DateStrLen) with one byte/char per element
        for row in vals:
            chars: list[str] = []
            for ch in row:
                if isinstance(ch, (bytes, np.bytes_)):
                    chars.append(ch.decode("utf-8", errors="ignore"))
                else:
                    chars.append(str(ch))
            s = "".join(chars).strip()
            if s:
                raw_strings.append(s)
    elif vals.ndim == 1:
        # xarray-collapsed layout: each element is a complete fixed-length byte string
        for elem in vals:
            if isinstance(elem, (bytes, np.bytes_)):
                s = elem.decode("utf-8", errors="ignore").strip()
            else:
                s = str(elem).strip()
            if s:
                raw_strings.append(s)
    else:
        return None

    if not raw_strings:
        return None

    # Normalise WRF-format timestamps (YYYY-MM-DD_HH:MM:SS) to ISO 8601
    # (YYYY-MM-DDTHH:MM:SSZ).  parse_analysis_time_guess already handles both
    # WRF and ISO formats, so this is safe to apply unconditionally.
    out: list[str] = []
    for s in raw_strings:
        dt = parse_analysis_time_guess(s)
        if dt is not None:
            out.append(dt.strftime("%Y-%m-%dT%H:%M:%SZ"))
        else:
            out.append(s)  # keep as-is if unparseable (shouldn't happen in practice)
    return out or None


def infer_times(ds: xr.Dataset, da: xr.DataArray) -> list[str] | None:
    """Infer a list of time strings aligned with the Time dimension."""
    # Prefer coordinate named exactly 'Time' on the dataarray
    if "Time" in da.coords:
        tvals = da.coords["Time"].values
    elif "Time" in ds.coords:
        tvals = ds.coords["Time"].values
    elif "XTIME" in ds:
        tvals = ds["XTIME"].values
    elif "Times" in ds:
        return _try_decode_wrf_times(ds["Times"])
    else:
        return None

    out: list[str] = []
    for t in np.asarray(tvals):
        if isinstance(t, np.datetime64):
            # Seconds resolution is enough for UI timelines; append Z to mark UTC
            s = np.datetime_as_string(t, unit="s")
            if not s.endswith("Z"):
                s += "Z"
            out.append(s)
        elif isinstance(t, (bytes, np.bytes_)):
            out.append(t.decode("utf-8", errors="ignore").strip())
        else:
            out.append(str(t))
    return out or None


def infer_times_from_ds(ds: xr.Dataset) -> list[str] | None:
    if "Time" in ds.coords:
        tvals = ds.coords["Time"].values
    elif "XTIME" in ds:
        tvals = ds["XTIME"].values
    elif "Times" in ds:
        return _try_decode_wrf_times(ds["Times"])
    else:
        return None
    out: list[str] = []
    for t in np.asarray(tvals):
        if isinstance(t, np.datetime64):
            s = np.datetime_as_string(t, unit="s")
            if not s.endswith("Z"):
                s += "Z"
            out.append(s)
        elif isinstance(t, (bytes, np.bytes_)):
            out.append(t.decode("utf-8", errors="ignore").strip())
        else:
            out.append(str(t))
    return out or None


def infer_analysis_time(ds: xr.Dataset, times: list[str] | None) -> datetime | None:
    if times:
        dt = parse_analysis_time_guess(times[0])
        if dt:
            return dt
    for key in ("START_DATE", "SIMULATION_START_DATE"):
        val = ds.attrs.get(key)
        if isinstance(val, str):
            dt = parse_analysis_time_guess(val)
            if dt:
                return dt
    return None


def infer_history_interval_minutes(times: list[str] | None) -> int | None:
    """Return the uniform time step in minutes, or None if steps are non-uniform.

    A single representative interval only makes sense for models whose output is
    evenly spaced in time (e.g. RAP at 60 min).  Non-uniform models such as
    ICON-EU (79 × 1 h followed by 14 × 3 h) will return None here, causing
    historyIntervalMinutes to be omitted from the manifest.  The manifest times
    array is the authoritative source for those models.
    """
    if not times or len(times) < 2:
        return None
    deltas: list[float] = []
    for prev, curr in zip(times, times[1:]):
        dt_prev = parse_analysis_time_guess(prev)
        dt_curr = parse_analysis_time_guess(curr)
        if not dt_prev or not dt_curr:
            continue
        delta = (dt_curr - dt_prev).total_seconds() / 60.0
        if delta > 0:
            deltas.append(delta)
    if not deltas:
        return None
    # Return None for non-uniform series so the manifest field is omitted.
    unique_rounded = {int(round(d)) for d in deltas}
    if len(unique_rounded) > 1:
        return None
    return int(round(float(np.median(deltas))))


@dataclass(frozen=True)
class BoundsInference:
    bounds: list[float]
    lat_var: str
    lon_var: str
    normalized_lon: bool


def infer_bounds(
    ds: xr.Dataset,
    *,
    lat_var: str | None,
    lon_var: str | None,
    time_index: int = 0,
) -> BoundsInference | None:
    """Infer lon/lat bounds from coordinate variables.

    Optimized for large global rectilinear grids stored as WRF-like XLAT/XLONG.
    For rectilinear (meshgrid-like) coordinates, we compute min/max from 1D edge
    slices to avoid loading the full 2D arrays into memory.

    Supports WRF-like coordinates where lat/lon are stored as 3D arrays:
      XLAT(Time, south_north, west_east)
      XLONG(Time, south_north, west_east)

    If lon appears to be 0..360, we attempt a -180..180 normalization and keep it
    only if it makes the extent more compact.
    """
    candidates: list[tuple[str, str]] = []

    if lat_var and lon_var:
        candidates.append((lat_var, lon_var))

    # Common fallbacks (including WRF defaults)
    candidates.extend(
        [
            ("XLAT", "XLONG"),
            ("lat", "lon"),
            ("latitude", "longitude"),
            ("LAT", "LON"),
        ]
    )

    def _maybe_isel_time(da: xr.DataArray) -> xr.DataArray:
        if "Time" in da.dims:
            return da.isel(Time=time_index)
        return da

    for lat_name, lon_name in candidates:
        if lat_name not in ds or lon_name not in ds:
            continue

        lat = _maybe_isel_time(ds[lat_name])
        lon = _maybe_isel_time(ds[lon_name])

        try:
            # Fast path: rectilinear meshgrid stored as 2D lat/lon.
            # We only read a few 1D slices to test rectilinearity and compute bounds.
            if lat.ndim == 2 and lon.ndim == 2:
                ny, nx = lat.shape

                # Read minimal slices (xarray will only touch these chunks).
                lat_col0 = np.asarray(
                    lat.isel({lat.dims[1]: 0}).values, dtype=np.float64
                )  # (ny,)
                lon_row0 = np.asarray(
                    lon.isel({lon.dims[0]: 0}).values, dtype=np.float64
                )  # (nx,)

                # Sanity: any finite values?
                if not np.isfinite(lat_col0).any() or not np.isfinite(lon_row0).any():
                    continue

                # Rectilinearity check via sampling a couple more slices.
                # lat should not vary with x; lon should not vary with y.
                # Sample middle and last indices to avoid full loads.
                sample_x = [0, nx // 2, nx - 1] if nx >= 3 else [0, nx - 1]
                sample_y = [0, ny // 2, ny - 1] if ny >= 3 else [0, ny - 1]

                lat_ok = True
                for x in sample_x:
                    lat_col = np.asarray(
                        lat.isel({lat.dims[1]: x}).values, dtype=np.float64
                    )
                    if float(np.nanmax(np.abs(lat_col - lat_col0))) > 1e-8:
                        lat_ok = False
                        break

                lon_ok = True
                for y in sample_y:
                    lon_row = np.asarray(
                        lon.isel({lon.dims[0]: y}).values, dtype=np.float64
                    )
                    if float(np.nanmax(np.abs(lon_row - lon_row0))) > 1e-8:
                        lon_ok = False
                        break

                if lat_ok and lon_ok:
                    min_lat = float(np.nanmin(lat_col0))
                    max_lat = float(np.nanmax(lat_col0))
                    min_lon = float(np.nanmin(lon_row0))
                    max_lon = float(np.nanmax(lon_row0))

                    normalized = False
                    if max_lon > 180 and min_lon >= 0:
                        lon_norm = ((lon_row0 + 180.0) % 360.0) - 180.0
                        min_lon2 = float(np.nanmin(lon_norm))
                        max_lon2 = float(np.nanmax(lon_norm))
                        if (max_lon2 - min_lon2) <= (max_lon - min_lon):
                            min_lon, max_lon = min_lon2, max_lon2
                            normalized = True

                    if min_lon < max_lon and min_lat < max_lat:
                        return BoundsInference(
                            bounds=[min_lon, min_lat, max_lon, max_lat],
                            lat_var=lat_name,
                            lon_var=lon_name,
                            normalized_lon=normalized,
                        )

            # Fallback: load full arrays (curvilinear or other shapes).
            lat_vals = np.asarray(lat.values, dtype=np.float64)
            lon_vals = np.asarray(lon.values, dtype=np.float64)

            if not np.isfinite(lat_vals).any() or not np.isfinite(lon_vals).any():
                continue

            min_lat = float(np.nanmin(lat_vals))
            max_lat = float(np.nanmax(lat_vals))
            min_lon = float(np.nanmin(lon_vals))
            max_lon = float(np.nanmax(lon_vals))

            normalized = False
            if max_lon > 180 and min_lon >= 0:
                lon_norm = ((lon_vals + 180.0) % 360.0) - 180.0
                min_lon2 = float(np.nanmin(lon_norm))
                max_lon2 = float(np.nanmax(lon_norm))
                if (max_lon2 - min_lon2) <= (max_lon - min_lon):
                    min_lon, max_lon = min_lon2, max_lon2
                    normalized = True

            if min_lon >= max_lon or min_lat >= max_lat:
                continue

            return BoundsInference(
                bounds=[min_lon, min_lat, max_lon, max_lat],
                lat_var=lat_name,
                lon_var=lon_name,
                normalized_lon=normalized,
            )
        except Exception:
            continue

    return None


def _is_monotonic_1d(vals: np.ndarray) -> bool:
    vals = np.asarray(vals, dtype=np.float64)
    if vals.size < 2:
        return False
    diffs = np.diff(vals)
    # allow non-strict monotonic (duplicate points are unusual but we don't want false negatives)
    pos = np.all(diffs >= 0)
    neg = np.all(diffs <= 0)
    return bool(pos or neg)


def _is_nearly_regular_spacing_1d(
    vals: np.ndarray, *, atol: float = 1e-6, rtol: float = 1e-3
) -> bool:
    """Return True if a 1D coordinate is close to evenly spaced.

    This is important because our output georeferencing uses bounds + shape (implying linear spacing).
    Some grids are rectilinear but not evenly spaced (e.g., Gaussian latitude); those should be regridded.
    """
    vals = np.asarray(vals, dtype=np.float64)
    if vals.size < 3:
        return False
    diffs = np.diff(vals)
    # Drop zero diffs (shouldn't exist, but avoid divide-by-zero / median issues).
    diffs = diffs[np.isfinite(diffs)]
    if diffs.size < 2:
        return False
    med = float(np.median(diffs))
    if med == 0.0:
        return False
    max_dev = float(np.max(np.abs(diffs - med)))
    tol = max(atol, rtol * abs(med))
    return bool(max_dev <= tol)


def _score_latlon_candidate(name: str, var: xr.DataArray, kind: str) -> int:
    """Heuristic scoring for picking lat/lon coordinate variables."""
    lname = name.lower()
    std = str(var.attrs.get("standard_name", "")).lower()
    units = str(var.attrs.get("units", "")).lower()

    score = 0
    if kind == "lat":
        if lname in ("lat", "latitude"):
            score += 20
        if std == "latitude":
            score += 15
        if "degrees_north" in units or "degree_north" in units:
            score += 8
    else:
        if lname in ("lon", "longitude"):
            score += 20
        if std == "longitude":
            score += 15
        if "degrees_east" in units or "degree_east" in units:
            score += 8
    return score


def _find_1d_lat_lon(
    ds: xr.Dataset, da: xr.DataArray
) -> tuple[xr.DataArray | None, xr.DataArray | None]:
    """Try to find 1D latitude and longitude coordinates for the dataarray.

    We search coords first (preferred), then any dataset variables, using:
      - variable name (lat/lon/latitude/longitude)
      - CF standard_name (latitude/longitude)
      - units (degrees_north / degrees_east)

    We also require the candidate to be 1D and aligned with one of da's dims.
    """
    lat_best: tuple[int, xr.DataArray] | None = None
    lon_best: tuple[int, xr.DataArray] | None = None

    # Prefer coords, but fall back to variables if lat/lon weren't promoted to coords.
    all_names: list[str] = list(ds.coords.keys())
    for n in ds.variables.keys():
        if n not in all_names:
            all_names.append(n)

    for name in all_names:
        try:
            var = ds[name]
        except Exception:
            continue
        if getattr(var, "ndim", 0) != 1:
            continue
        if not var.dims:
            continue
        dim = var.dims[0]
        if dim not in da.dims:
            continue
        # Make sure lengths match the data dimension.
        if int(var.sizes.get(dim, -1)) != int(da.sizes.get(dim, -2)):
            continue

        lat_score = _score_latlon_candidate(name, var, "lat")
        if lat_score > 0:
            if lat_best is None or lat_score > lat_best[0]:
                lat_best = (lat_score, var)

        lon_score = _score_latlon_candidate(name, var, "lon")
        if lon_score > 0:
            if lon_best is None or lon_score > lon_best[0]:
                lon_best = (lon_score, var)

    return (lat_best[1] if lat_best else None, lon_best[1] if lon_best else None)


def _xlatxlong_are_rectilinear(
    ds: xr.Dataset,
    *,
    time_index: int = 0,
    mesh_tol: float = 1e-5,
    spacing_atol: float = 1e-6,
    spacing_rtol: float = 1e-3,
) -> bool:
    """Detect WRF-like XLAT/XLONG that are actually a regular rectilinear lat/lon grid.

    Some files store lat/lon as 2D (or 3D with Time) arrays even when the grid is really
    rectilinear (meshgrid). If XLAT varies only with the south_north axis and XLONG varies
    only with the west_east axis *and* the implied 1D coords are near-evenly spaced, then
    we can skip regridding safely.

    Why check spacing? Our output georeferencing uses bounds + shape (linear mapping). If the
    grid is rectilinear but not evenly spaced (e.g., Gaussian latitude), skipping regrid would
    produce small but systematic positional errors.
    """
    if "XLAT" not in ds or "XLONG" not in ds:
        return False
    try:
        lat, lon = get_xlat_xlong_2d(ds, time_index=time_index)

        lat_vals = np.asarray(lat.values, dtype=np.float64)
        lon_vals = np.asarray(lon.values, dtype=np.float64)
        if not np.isfinite(lat_vals).any() or not np.isfinite(lon_vals).any():
            return False

        # Rectilinear meshgrid test:
        # - each row of lat should be (almost) constant across x
        # - each column of lon should be (almost) constant across y
        lat_row_ptp = np.nanmax(
            np.nanmax(lat_vals, axis=1) - np.nanmin(lat_vals, axis=1)
        )
        lon_col_ptp = np.nanmax(
            np.nanmax(lon_vals, axis=0) - np.nanmin(lon_vals, axis=0)
        )
        if float(lat_row_ptp) > mesh_tol or float(lon_col_ptp) > mesh_tol:
            return False

        lat1d = lat_vals[:, 0]
        lon1d = lon_vals[0, :]

        if not (_is_monotonic_1d(lat1d) and _is_monotonic_1d(lon1d)):
            return False

        if not (
            _is_nearly_regular_spacing_1d(lat1d, atol=spacing_atol, rtol=spacing_rtol)
            and _is_nearly_regular_spacing_1d(
                lon1d, atol=spacing_atol, rtol=spacing_rtol
            )
        ):
            return False

        return True
    except Exception:
        return False

        # candidate 1D vectors
        lat1d = lat_vals[:, 0]
        lon1d = lon_vals[0, :]

        # Check broadcast equality: lat varies only with y, lon varies only with x.
        lat_b = lat1d[:, None]
        lon_b = lon1d[None, :]

        lat_ok = float(np.nanmax(np.abs(lat_vals - lat_b))) <= tol
        lon_ok = float(np.nanmax(np.abs(lon_vals - lon_b))) <= tol
        return bool(lat_ok and lon_ok)
    except Exception:
        return False


def is_regular_latlon(ds: xr.Dataset, da: xr.DataArray) -> bool:
    """Return True if the data is already on a regular (rectilinear) lat/lon grid."""
    lat, lon = _find_1d_lat_lon(ds, da)
    if lat is not None and lon is not None:
        lat_vals = np.asarray(lat.values, dtype=np.float64)
        lon_vals = np.asarray(lon.values, dtype=np.float64)
        if (
            _is_monotonic_1d(lat_vals)
            and _is_monotonic_1d(lon_vals)
            and _is_nearly_regular_spacing_1d(lat_vals)
            and _is_nearly_regular_spacing_1d(lon_vals)
        ):
            return True

    # Secondary heuristic for WRF-like files that store a rectilinear lat/lon as 2D XLAT/XLONG.
    if _xlatxlong_are_rectilinear(ds, time_index=0):
        return True

    return False


def needs_regrid(ds: xr.Dataset, da: xr.DataArray) -> bool:
    """Return True if we should regrid to a regular lat/lon target grid."""
    # If it's already a regular lat/lon grid, do not regrid.
    if is_regular_latlon(ds, da):
        return False

    # WRF-like curvilinear coordinates
    if "XLAT" in ds and "XLONG" in ds:
        return True

    # Projection metadata usually indicates a curvilinear/projection grid as well.
    if "MAP_PROJ4_STR" in ds.attrs or ds.attrs.get("MAP_PROJ_CHAR"):
        return True

    return False


def _summarize_grid_info(
    ds: xr.Dataset,
    variables: list[str],
    *,
    bounds: list[float] | None,
    coord_vars: dict[str, Any] | None,
    no_regrid: bool,
) -> str:
    """Create a human-readable summary of grid detection and regrid decisions."""
    lines: list[str] = []
    lines.append("=== Grid / Regrid Info ===")
    lines.append(f"Dims: {dict(ds.dims)}")
    has_xlat = "XLAT" in ds.variables
    has_xlong = "XLONG" in ds.variables
    lines.append(f"Has XLAT/XLONG: {has_xlat}/{has_xlong}")

    if has_xlat and has_xlong:
        try:
            xlat = ds["XLAT"]
            xlong = ds["XLONG"]
            lines.append(f"XLAT dims: {xlat.dims}, dtype: {xlat.dtype}")
            lines.append(f"XLONG dims: {xlong.dims}, dtype: {xlong.dtype}")

            lat2, lon2 = get_xlat_xlong_2d(ds, time_index=0)
            lines.append(f"XLAT 2D shape: {lat2.shape}")
            lines.append(f"XLONG 2D shape: {lon2.shape}")
            lines.append(f"XLAT has Time dim: {'Time' in xlat.dims}")
            lines.append(f"XLONG has Time dim: {'Time' in xlong.dims}")
            # Cheap 1D slices only
            lat1d = np.asarray(lat2.isel({lat2.dims[1]: 0}).values, dtype=np.float64)
            lon1d = np.asarray(lon2.isel({lon2.dims[0]: 0}).values, dtype=np.float64)
            if lat1d.size >= 2 and lon1d.size >= 2:
                dlat = np.diff(lat1d)
                dlon = np.diff(lon1d)
                lines.append(f"XLAT step (median): {float(np.median(dlat)):.6g} deg")
                lines.append(f"XLONG step (median): {float(np.median(dlon)):.6g} deg")
        except Exception as e:
            lines.append(f"(Could not inspect XLAT/XLONG: {e})")

    if bounds is not None:
        lines.append(f"Bounds: [min_lon, min_lat, max_lon, max_lat] = {bounds}")
    if coord_vars is not None:
        lines.append(f"Coord vars: {coord_vars}")

    lines.append(f"Manual no-regrid override: {no_regrid}")
    lines.append("Per-variable regrid decision:")
    for v in variables:
        try:
            da = ds[v]
            decision = False if no_regrid else needs_regrid(ds, da)
            lines.append(f"  - {v}: needs_regrid={decision}")
        except Exception as e:
            lines.append(f"  - {v}: (error evaluating) {e}")

    return "\n".join(lines)


def normalize_lon_vals(lon_vals: np.ndarray) -> tuple[np.ndarray, bool]:
    min_lon = float(np.nanmin(lon_vals))
    max_lon = float(np.nanmax(lon_vals))
    if max_lon > 180 and min_lon >= 0:
        lon_norm = ((lon_vals + 180.0) % 360.0) - 180.0
        min_lon2 = float(np.nanmin(lon_norm))
        max_lon2 = float(np.nanmax(lon_norm))
        if (max_lon2 - min_lon2) <= (max_lon - min_lon):
            return lon_norm, True
    return lon_vals, False


def get_xlat_xlong_2d(
    ds: xr.Dataset, time_index: int = 0
) -> tuple[xr.DataArray, xr.DataArray]:
    if "XLAT" not in ds or "XLONG" not in ds:
        raise ValueError("XLAT/XLONG variables are required but missing from dataset.")
    lat = ds["XLAT"]
    lon = ds["XLONG"]
    if "Time" in lat.dims:
        lat = lat.isel(Time=time_index)
    if "Time" in lon.dims:
        lon = lon.isel(Time=time_index)
    if lat.ndim != 2 or lon.ndim != 2:
        raise ValueError(
            f"XLAT/XLONG must be 2D after Time selection. Got XLAT dims={lat.dims}, XLONG dims={lon.dims}."
        )
    if lat.shape != lon.shape:
        raise ValueError(f"XLAT/XLONG shape mismatch: {lat.shape} vs {lon.shape}")
    return lat, lon


def infer_target_bounds_from_xlatlon(ds: xr.Dataset) -> list[float]:
    lat_da, lon_da = get_xlat_xlong_2d(ds, time_index=0)
    lat = lat_da.values.astype(np.float64)
    lon = lon_da.values.astype(np.float64)
    lon_norm, _ = normalize_lon_vals(lon)
    return [
        float(np.nanmin(lon_norm)),
        float(np.nanmin(lat)),
        float(np.nanmax(lon_norm)),
        float(np.nanmax(lat)),
    ]


def build_target_grid(
    bounds: list[float],
    *,
    res_deg: float | None,
    shape: tuple[int, int] | None,
    detail_scale: float = 1.0,
) -> tuple[np.ndarray, np.ndarray, int, int]:
    min_lon, min_lat, max_lon, max_lat = bounds
    if detail_scale <= 0:
        raise ValueError("detail_scale must be > 0")
    orig_width = orig_height = None
    orig_res_deg = res_deg
    if shape is not None:
        orig_width, orig_height = shape
        width = max(1, int(round(orig_width * detail_scale)))
        height = max(1, int(round(orig_height * detail_scale)))
        lons = np.linspace(min_lon, max_lon, num=width, dtype=np.float64)
        lats = np.linspace(min_lat, max_lat, num=height, dtype=np.float64)
    elif res_deg is not None:
        if detail_scale != 1.0:
            res_deg = res_deg / detail_scale
        width = int(round((max_lon - min_lon) / res_deg)) + 1
        height = int(round((max_lat - min_lat) / res_deg)) + 1
        lons = np.linspace(min_lon, max_lon, num=width, dtype=np.float64)
        lats = np.linspace(min_lat, max_lat, num=height, dtype=np.float64)
    else:
        raise ValueError("target shape or resolution is required for regridding")
    lon2d, lat2d = np.meshgrid(lons, lats)
    return lon2d, lat2d, width, height


def _hash_grid_for_weights(
    *,
    method: str,
    src_lon: np.ndarray,
    src_lat: np.ndarray,
    dst_lon: np.ndarray,
    dst_lat: np.ndarray,
    max_samples: int = 250_000,
) -> str:
    """Create a stable hash for a src/dst grid pair.

    We avoid hashing *every* element for very large grids by downsampling to at most
    `max_samples` elements per array. This keeps hashing overhead low while making
    collisions extremely unlikely in practice.
    """
    h = hashlib.sha256()
    h.update(method.encode("utf-8"))
    for arr in (src_lon, src_lat, dst_lon, dst_lat):
        a = np.asarray(arr, dtype=np.float32)
        h.update(str(a.shape).encode("utf-8"))
        flat = a.ravel()
        if flat.size > max_samples:
            step = max(1, int(flat.size // max_samples))
            flat = flat[::step][:max_samples]
        # Normalize NaNs/Infs so hashing is stable.
        flat = np.nan_to_num(flat, nan=0.0, posinf=1e30, neginf=-1e30)
        h.update(flat.tobytes())
    return h.hexdigest()[:32]


def _summarize_array(
    name: str,
    arr: np.ndarray,
    *,
    missing_values: list[float] | None = None,
    max_unique: int = 50,
) -> str:
    arr = np.asarray(arr)
    finite = np.isfinite(arr)
    finite_count = int(np.sum(finite))
    nan_count = int(np.sum(~finite))
    missing_count = 0
    if missing_values:
        for mv in missing_values:
            try:
                missing_count += int(np.sum(arr == mv))
            except Exception:
                pass
    if finite_count:
        flat = arr[finite].astype(np.float64)
        p1, p50, p99 = np.nanpercentile(flat, [1, 50, 99]).tolist()
        min_v = float(np.nanmin(flat))
        max_v = float(np.nanmax(flat))
        if flat.size > 100000:
            flat = flat[:: max(1, flat.size // 100000)]
        uniques = np.unique(flat)
        uniq_count = int(min(len(uniques), max_unique))
        return (
            f"[{name}] shape={arr.shape} dtype={arr.dtype} finite={finite_count} "
            f"nan={nan_count} missing={missing_count} "
            f"min={min_v:.6g} p1={p1:.6g} p50={p50:.6g} p99={p99:.6g} max={max_v:.6g} "
            f"uniq~={uniq_count}"
        )
    return f"[{name}] shape={arr.shape} dtype={arr.dtype} finite=0 nan={nan_count} missing={missing_count}"


def _regrid_with_mask(regridder: Any, da: xr.DataArray) -> xr.DataArray:
    # Regrid data and a validity mask to avoid filling outside-domain with zeros.
    regridded = regridder(da)
    mask_src = xr.where(np.isfinite(da), 1.0, 0.0)
    mask_dst = regridder(mask_src)
    return regridded.where(mask_dst >= 0.5)


def _build_distance_domain_mask(
    src_lat: np.ndarray,
    src_lon: np.ndarray,
    dst_lat: np.ndarray,
    dst_lon: np.ndarray,
) -> "np.ndarray | None":
    """Return a boolean 2-D mask (same shape as dst_lat) that is True where a
    destination cell has a source cell within approximately one grid spacing.

    With nearest-neighbour regridding a destination cell either maps one-to-one
    onto a source cell or it doesn't.  xESMF without ``unmapped_to_nan`` assigns
    every unmapped destination cell the value of its nearest source cell no
    matter how far away that is.  This function restores the correct behaviour:
    a destination cell with no nearby source cell is outside the domain → NaN.

    The threshold is 1.5 × the median distance between adjacent source cells,
    making it robust to non-uniform curvilinear grids without any knowledge of
    the underlying projection.

    Returns None if the computation fails (caller falls back to regridder mask).
    """
    try:
        from scipy.spatial import cKDTree

        src_flat_lat = src_lat.ravel().astype(np.float64)
        src_flat_lon = src_lon.ravel().astype(np.float64)
        valid = np.isfinite(src_flat_lat) & np.isfinite(src_flat_lon)
        src_flat_lat = src_flat_lat[valid]
        src_flat_lon = src_flat_lon[valid]
        if len(src_flat_lat) < 4:
            return None

        # Estimate grid spacing from adjacent cells across the interior of the grid.
        ny, nx = src_lat.shape
        mid_y = ny // 2
        mid_x = nx // 2
        dy = float(abs(src_lat[mid_y + 1, mid_x] - src_lat[mid_y, mid_x]))
        dx = float(abs(src_lon[mid_y, mid_x + 1] - src_lon[mid_y, mid_x]))
        grid_spacing = max(dy, dx)
        threshold = grid_spacing * 1.5

        tree = cKDTree(np.column_stack([src_flat_lat, src_flat_lon]))
        dst_points = np.column_stack([
            dst_lat.ravel().astype(np.float64),
            dst_lon.ravel().astype(np.float64),
        ])
        distances, _ = tree.query(dst_points)
        return (distances <= threshold).reshape(dst_lat.shape)
    except Exception:
        return None


def regrid_dataarray(
    regridder: Any,
    da: xr.DataArray,
    *,
    var_name: str | None = None,
    debug: bool = False,
) -> xr.DataArray:
    """Regrid a data array, handling circular direction fields in vector space.

    Example: scalar interpolation of [359, 1] incorrectly trends toward 180.
    This path converts the angle to unit-vector components first, regrids those,
    then reconstructs the direction near 0 as expected.
    """
    if not is_directional_variable(var_name or "", da):
        return _regrid_with_mask(regridder, da)

    src = np.asarray(da.values, dtype=np.float32)
    u_src, v_src = wind_from_dir_deg_to_uv(src)
    u_da = da.copy(data=u_src)
    v_da = da.copy(data=v_src)
    u_regridded = _regrid_with_mask(regridder, u_da)
    v_regridded = _regrid_with_mask(regridder, v_da)
    u_arr = np.asarray(u_regridded.values, dtype=np.float32)
    v_arr = np.asarray(v_regridded.values, dtype=np.float32)
    dir_arr = uv_to_wind_from_dir_deg(u_arr, v_arr)
    dir_arr[~np.isfinite(u_arr) | ~np.isfinite(v_arr)] = np.nan

    if debug:
        src_finite = src[np.isfinite(src)]
        dir_finite = dir_arr[np.isfinite(dir_arr)]
        src_min = float(np.nanmin(src_finite)) if src_finite.size else float("nan")
        src_max = float(np.nanmax(src_finite)) if src_finite.size else float("nan")
        u_finite = u_arr[np.isfinite(u_arr)]
        v_finite = v_arr[np.isfinite(v_arr)]
        u_min = float(np.nanmin(u_finite)) if u_finite.size else float("nan")
        u_max = float(np.nanmax(u_finite)) if u_finite.size else float("nan")
        v_min = float(np.nanmin(v_finite)) if v_finite.size else float("nan")
        v_max = float(np.nanmax(v_finite)) if v_finite.size else float("nan")
        dir_min = float(np.nanmin(dir_finite)) if dir_finite.size else float("nan")
        dir_max = float(np.nanmax(dir_finite)) if dir_finite.size else float("nan")
        print(
            f"[{var_name or da.name or 'unknown'}] directional regrid path used "
            f"src_dir_minmax=({src_min:.6g},{src_max:.6g}) "
            f"dst_u_minmax=({u_min:.6g},{u_max:.6g}) "
            f"dst_v_minmax=({v_min:.6g},{v_max:.6g}) "
            f"dst_dir_minmax=({dir_min:.6g},{dir_max:.6g})"
        )

    return da.copy(data=dir_arr)


def build_regrid_domain_mask(regridder: Any, da: xr.DataArray) -> xr.DataArray:
    """Build a persistent destination mask for a regridded variable."""
    mask_src = xr.where(np.isfinite(da), 1.0, 0.0)
    mask_dst = regridder(mask_src)
    return mask_dst >= 0.5


def decode_to_float(
    da: xr.DataArray, *, ignore_missing_zero: bool = False
) -> xr.DataArray:
    """Decode packed values to float and mask missing values."""
    arr = np.asarray(da.values)
    attrs = da.attrs or {}
    missing_values: list[float] = []
    for key in ("missing_value", "_FillValue"):
        if key in attrs:
            missing_values.append(attrs[key])
    if "_FillValue" in da.encoding:
        missing_values.append(da.encoding.get("_FillValue"))
    if ignore_missing_zero:

        def is_zero_value(val: Any) -> bool:
            try:
                return float(val) == 0.0
            except Exception:
                try:
                    return bool(np.allclose(val, 0.0))
                except Exception:
                    return False

        missing_values = [mv for mv in missing_values if not is_zero_value(mv)]
    mask = np.zeros(arr.shape, dtype=bool)
    for mv in missing_values:
        try:
            if np.ndim(mv) != 0:
                continue
            mask |= arr == mv
        except Exception:
            pass
    scale = attrs.get("scale_factor", 1.0)
    offset = attrs.get("add_offset", 0.0)
    arr_f = arr.astype(np.float32, copy=False)
    try:
        arr_f = arr_f * float(scale) + float(offset)
    except Exception:
        arr_f = arr_f.astype(np.float32)
    if mask.any():
        arr_f = arr_f.astype(np.float32, copy=False)
        arr_f = arr_f.copy()
        arr_f[mask] = np.nan
    return xr.DataArray(arr_f, dims=da.dims, coords=da.coords, attrs=da.attrs)


def is_precip_variable(var_name: str) -> bool:
    v = var_name.lower()
    return "precip" in v or "lwe" in v


# ── Derived variable support ──────────────────────────────────────────────────

# Required source variables for each derivable variable.
DERIVED_VARIABLE_SOURCES: dict[str, tuple[str, ...]] = {
    "snow_fraction": ("lwe_snowfall_rate", "lwe_precipitation_rate"),
}


def can_derive_variable(variable: str, ds: xr.Dataset) -> bool:
    """Return True if `variable` can be computed from variables already in `ds`."""
    sources = DERIVED_VARIABLE_SOURCES.get(variable)
    if sources is None:
        return False
    return all(s in ds.data_vars for s in sources)


def derive_snow_fraction(ds: xr.Dataset) -> xr.DataArray:
    """
    Compute snow_fraction = lwe_snowfall_rate / lwe_precipitation_rate.

    Rules applied:
    - Time step 0 is forced to 0: both rate variables may be poorly defined there.
    - Zero or NaN precipitation → snow_fraction = 0 (avoids division-by-zero).
    - Result is clamped to [0, 1].
    """
    snowfall = decode_to_float(ds["lwe_snowfall_rate"], ignore_missing_zero=True)
    precip = decode_to_float(ds["lwe_precipitation_rate"], ignore_missing_zero=True)

    sf_vals = np.asarray(snowfall.values, dtype=np.float32)
    pr_vals = np.asarray(precip.values, dtype=np.float32)

    # Only compute the fraction where BOTH the total precipitation rate AND the
    # snowfall rate exceed a meaningful threshold.  Below 0.25 mm hr⁻¹ the ratio
    # is dominated by numerical noise rather than real physics, so we zero it out.
    MIN_RATE_MMHR = 0.25
    with np.errstate(divide="ignore", invalid="ignore"):
        frac = np.where(
            np.isfinite(pr_vals) & (pr_vals >= MIN_RATE_MMHR)
            & np.isfinite(sf_vals) & (sf_vals >= MIN_RATE_MMHR),
            sf_vals / pr_vals,
            0.0,
        )
    frac = np.clip(frac, 0.0, 1.0).astype(np.float32)

    # Zero out time step 0 — rate variables are typically unreliable at t=0.
    has_time = "Time" in snowfall.dims
    if has_time and frac.ndim >= 1 and frac.shape[0] > 0:
        frac[0] = 0.0

    return xr.DataArray(
        frac,
        dims=snowfall.dims,
        coords=snowfall.coords,
        attrs={
            "units": "1",
            "long_name": "Fraction of frozen precipitation",
            "description": "Derived: lwe_snowfall_rate / lwe_precipitation_rate",
        },
    )


def apply_snow_fraction_rate_mask(da: "xr.DataArray", ds: "xr.Dataset") -> "xr.DataArray":
    """
    Zero out snow_fraction values where precipitation rates are below MIN_RATE_MMHR.

    This is called when snow_fraction is read *directly* from the input NetCDF
    rather than being derived by derive_snow_fraction().  Without this step,
    domains whose model outputs snow_fraction as a native variable (and may lack
    lwe_snowfall_rate entirely) would export unmasked values, causing symbols to
    appear over areas with no meaningful precipitation.

    The masking rule is identical to the one in derive_snow_fraction(): a pixel
    is zeroed out unless BOTH lwe_precipitation_rate >= MIN_RATE_MMHR AND
    lwe_snowfall_rate >= MIN_RATE_MMHR.  If only one rate variable is present,
    only that variable's threshold is enforced; if neither is present the array
    is returned unchanged (nothing to mask against).
    """
    MIN_RATE_MMHR = 0.25
    vals = np.asarray(da.values, dtype=np.float32).copy()

    # Start with "all pixels pass"; narrow down with each available rate variable.
    keep = np.ones(vals.shape, dtype=bool)

    for rate_var in ("lwe_precipitation_rate", "lwe_snowfall_rate"):
        if rate_var in ds.data_vars:
            rate = decode_to_float(ds[rate_var], ignore_missing_zero=True)
            r = np.asarray(rate.values, dtype=np.float32)
            keep &= np.isfinite(r) & (r >= MIN_RATE_MMHR)

    if not np.all(keep):
        vals = np.where(keep, vals, 0.0)

    return xr.DataArray(vals, dims=da.dims, coords=da.coords, attrs=da.attrs)


def compute_derived_variable(variable: str, ds: "xr.Dataset") -> "xr.DataArray | None":
    """
    Return a derived DataArray for `variable` if a recipe exists and all its
    source variables are present in `ds`.  Returns None otherwise.
    """
    if not can_derive_variable(variable, ds):
        return None
    if variable == "snow_fraction":
        return derive_snow_fraction(ds)
    return None


def _acquire_lock(
    lock_path: Path, *, poll_s: float = 0.25, timeout_s: float = 1800.0
) -> int:
    """Simple cross-process lock using an exclusive lockfile."""
    start = time.time()
    while True:
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_RDWR)
            return fd
        except FileExistsError:
            if (time.time() - start) > timeout_s:
                raise TimeoutError(f"Timed out waiting for lock: {lock_path}")
            time.sleep(poll_s)


def _release_lock(fd: int, lock_path: Path) -> None:
    try:
        os.close(fd)
    finally:
        try:
            lock_path.unlink(missing_ok=True)  # py3.8+: missing_ok
        except TypeError:
            if lock_path.exists():
                lock_path.unlink()


def build_regridder(
    ds: xr.Dataset,
    *,
    target_bounds: list[float],
    target_res_deg: float | None,
    target_shape: tuple[int, int] | None,
    detail_scale: float = 1.0,
    method: str,
    weights_dir: Path | None = None,
) -> tuple[Any, tuple[int, int], np.ndarray, np.ndarray]:
    """Build (or load) an xESMF regridder, caching weights on disk.

    Returns ``(regridder, (width, height), dst_lat2d, dst_lon2d)`` where
    ``dst_lat2d`` / ``dst_lon2d`` are the 2-D destination coordinate arrays.
    These are passed back so callers can build a geometric domain mask without
    having to recompute the target grid.
    """
    try:
        import xesmf as xe
    except ImportError as e:
        raise RuntimeError(
            "xESMF is required for regridding. Please install xesmf."
        ) from e

    lat, lon = get_xlat_xlong_2d(ds, time_index=0)
    lon_vals, _ = normalize_lon_vals(lon.values.astype(np.float64))

    src_grid = {
        "lon": lon_vals,
        "lat": lat.values.astype(np.float64),
    }

    if target_res_deg is None and target_shape is None:
        target_shape = (int(lat.shape[1]), int(lat.shape[0]))

    lon2d, lat2d, width, height = build_target_grid(
        target_bounds,
        res_deg=target_res_deg,
        shape=target_shape,
        detail_scale=detail_scale,
    )
    dst_grid = {"lon": lon2d, "lat": lat2d}

    method_map = {"bilinear": "bilinear", "nearest": "nearest_s2d"}
    method_xe = method_map.get(method, method)

    filename: str | None = None
    if weights_dir is not None:
        weights_dir.mkdir(parents=True, exist_ok=True)
        grid_hash = _hash_grid_for_weights(
            method=method_xe,
            src_lon=lon_vals,
            src_lat=src_grid["lat"],
            dst_lon=lon2d,
            dst_lat=lat2d,
        )
        filename = str(weights_dir / f"weights_{method_xe}_{grid_hash}.nc")

    regrid_kwargs: dict[str, Any] = {"unmapped_to_nan": True}
    if method_xe == "bilinear":
        regrid_kwargs["extrap_method"] = None

    # If no filename was provided, keep old behavior (no caching).
    if filename is None:
        try:
            regridder = xe.Regridder(
                src_grid, dst_grid, method_xe, reuse_weights=False, **regrid_kwargs
            )
        except TypeError:
            regridder = xe.Regridder(src_grid, dst_grid, method_xe, reuse_weights=False)
        return regridder, (width, height), lat2d, lon2d

    weight_path = Path(filename)
    lock_path = weight_path.with_suffix(weight_path.suffix + ".lock")

    # Race-safe creation: only one process computes weights, others wait and reuse.
    if weight_path.exists():
        try:
            regridder = xe.Regridder(
                src_grid,
                dst_grid,
                method_xe,
                filename=filename,
                reuse_weights=True,
                **regrid_kwargs,
            )
        except TypeError:
            regridder = xe.Regridder(
                src_grid, dst_grid, method_xe, filename=filename, reuse_weights=True
            )
        return regridder, (width, height), lat2d, lon2d

    fd = _acquire_lock(lock_path)
    try:
        if weight_path.exists():
            try:
                regridder = xe.Regridder(
                    src_grid,
                    dst_grid,
                    method_xe,
                    filename=filename,
                    reuse_weights=True,
                    **regrid_kwargs,
                )
            except TypeError:
                regridder = xe.Regridder(
                    src_grid, dst_grid, method_xe, filename=filename, reuse_weights=True
                )
        else:
            try:
                regridder = xe.Regridder(
                    src_grid,
                    dst_grid,
                    method_xe,
                    filename=filename,
                    reuse_weights=False,
                    **regrid_kwargs,
                )
            except TypeError:
                regridder = xe.Regridder(
                    src_grid,
                    dst_grid,
                    method_xe,
                    filename=filename,
                    reuse_weights=False,
                )
    finally:
        _release_lock(fd, lock_path)

    return regridder, (width, height)


def write_manifest(
    out_dir: Path,
    *,
    dataset_id: str,
    title: str,
    variable: str,
    unit: str | None,
    projection: str,
    bounds: list[float],
    src_min: float,
    src_max: float,
    image_unscale: list[float] | None,
    image_scale: str | None = None,
    fmt: str,
    prefix: str,
    count: int,
    width: int,
    height: int,
    times: list[str] | None,
    analysis_time: datetime | None,
    history_interval_minutes: int | None,
    coord_vars: dict[str, Any] | None,
    flip_y_applied: bool,
    scaling: dict[str, Any] | None = None,
    detail_scale: float = 1.0,
    target_width: int | None = None,
    target_height: int | None = None,
    encoding: dict[str, Any] | None = None,
    manifest_name: str = "manifest.json",
) -> Path:
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "id": dataset_id,
        "title": title,
        "variable": variable,
        "unit": unit,
        "projection": projection,
        "bounds": [float(x) for x in bounds],
        "srcMin": float(src_min),
        "srcMax": float(src_max),
        "imageUnscale": [float(x) for x in (image_unscale or [src_min, src_max])],
        **({"imageScale": image_scale} if image_scale else {}),
        "format": fmt.lower(),
        "prefix": prefix,
        "count": int(count),
        "fileTemplate": f"{prefix}{{index:03d}}.{fmt.lower()}",
        "shape": {"width": int(width), "height": int(height)},
        "encoding": encoding
        or {
            "kind": "scalar",
            "dtype": "uint8",
            "valueChannel": "R (from Luminance)",
            "nodata": "A==0",
        },
        "flipYApplied": bool(flip_y_applied),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    if times is not None:
        manifest["times"] = times

    if analysis_time is not None:
        # Required by the UI: analysis time in YYYY-MM-DD_hh format.
        manifest["analysisTime"] = analysis_time.strftime("%Y-%m-%d_%H")
        # Also include an ISO timestamp for machine-readability.
        manifest["analysisTimeISO"] = analysis_time.isoformat().replace("+00:00", "Z")

    if history_interval_minutes is not None:
        manifest["historyIntervalMinutes"] = int(history_interval_minutes)

    if coord_vars is not None:
        manifest["coordVars"] = coord_vars
    if scaling is not None:
        manifest["scaling"] = scaling
    if target_width is not None and target_height is not None:
        manifest["rendering"] = {
            "detailScale": float(detail_scale),
            "targetWidth": int(target_width),
            "targetHeight": int(target_height),
        }

    out_path = out_dir / manifest_name
    out_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote manifest: {out_path}")
    return out_path


def parse_isel(item: str) -> tuple[str, int]:
    """Parse --isel arguments like 'bottom_top=0'."""
    if "=" not in item:
        raise argparse.ArgumentTypeError("--isel must be DIM=INDEX (e.g. bottom_top=0)")
    dim, idx_s = item.split("=", 1)
    dim = dim.strip()
    idx_s = idx_s.strip()
    if not dim:
        raise argparse.ArgumentTypeError("--isel must be DIM=INDEX (empty dim)")
    try:
        idx = int(idx_s)
    except ValueError as e:
        raise argparse.ArgumentTypeError(
            f"--isel index must be int, got: {idx_s!r}"
        ) from e
    return dim, idx


def reduce_extra_dims(da: xr.DataArray, mode: str) -> xr.DataArray:
    """Reduce non-Time spatial extra dims to get a 2D (y,x) field."""
    allowed = {"Time", "south_north", "west_east"}
    extra_dims = [d for d in da.dims if d not in allowed]
    if not extra_dims:
        return da
    out = da
    for dim in extra_dims:
        if mode == "first":
            out = out.isel({dim: 0})
        elif mode == "max":
            out = out.max(dim=dim, keep_attrs=True)
        elif mode == "mean":
            out = out.mean(dim=dim, keep_attrs=True)
        else:
            raise ValueError(f"Unknown reduce mode: {mode}")
    return out


def list_candidate_vars(ds: xr.Dataset) -> list[tuple[str, str, str, str]]:
    out: list[tuple[str, str, str, str]] = []
    for name, da in ds.data_vars.items():
        dims = ",".join(da.dims)
        dtype = str(da.dtype)
        unit = str(da.attrs.get("units", ""))
        out.append((name, dims, dtype, unit))
    if WIND_U10_VAR in ds.data_vars and WIND_V10_VAR in ds.data_vars:
        out.append(
            (
                WIND_UV10_DATASET,
                "Time,south_north,west_east",
                "virtual-vector",
                "m s-1",
            )
        )
    return out


def load_variables_yml(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError("variables.yml root must be a mapping")
    return data


def load_scaling_policy(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if not isinstance(data, dict):
        raise ValueError("manifest_scaling_v2.yml root must be a mapping")
    if "variables" not in data or not isinstance(data["variables"], dict):
        raise ValueError("manifest_scaling_v2.yml must contain a variables mapping")
    return data


def resolve_aliases(raw: dict[str, Any]) -> dict[str, dict[str, Any]]:
    resolved: dict[str, dict[str, Any]] = {}
    resolving: set[str] = set()

    def resolve_one(key: str) -> dict[str, Any]:
        if key in resolved:
            return resolved[key]
        if key in resolving:
            raise ValueError(f"Cyclic alias in variables.yml: {key}")
        resolving.add(key)
        val = raw.get(key)
        if isinstance(val, str) and val.startswith("@"):
            target = val[1:]
            out = resolve_one(target).copy()
        elif isinstance(val, dict):
            out = dict(val)
            if isinstance(out.get("alias"), str) and out["alias"].startswith("@"):
                target = out["alias"][1:]
                base = resolve_one(target).copy()
                base.update({k: v for k, v in out.items() if k != "alias"})
                out = base
        else:
            out = {}
        resolving.remove(key)
        resolved[key] = out
        return out

    for k in raw.keys():
        resolve_one(k)
    return resolved


def validate_policy(policy: dict[str, Any]) -> None:
    for name, spec in policy.get("variables", {}).items():
        if not isinstance(spec, dict):
            raise ValueError(f"Policy entry {name} must be a mapping")
        for key in ("srcMin", "srcMax"):
            if key in spec and not isinstance(spec[key], (int, float)):
                raise ValueError(f"Policy {name}.{key} must be numeric")
        if "imageUnscale" in spec:
            iu = spec["imageUnscale"]
            if not (isinstance(iu, list) and len(iu) == 2):
                raise ValueError(f"Policy {name}.imageUnscale must be [min,max]")
        if "source_keys" in spec and not isinstance(spec["source_keys"], list):
            raise ValueError(f"Policy {name}.source_keys must be a list")


def get_scaling_policy(
    var_name: str, policy: dict[str, Any] | None
) -> tuple[str, dict[str, Any]] | None:
    if not policy:
        return None
    variables = policy.get("variables", {})
    if var_name in variables:
        return var_name, variables[var_name]
    # source_keys alias match
    for key, spec in variables.items():
        source_keys = spec.get("source_keys") or []
        if var_name in source_keys:
            return key, spec
    # height-aware base-name match
    base, height = parse_height_suffix(var_name)
    if height:
        for key, spec in variables.items():
            std_h = spec.get("standard_height")
            if std_h and str(std_h).lower() != height.lower():
                continue
            if key == base:
                return key, spec
    return None


def convert_data_to_canonical_units(
    da: xr.DataArray, from_units: str | None, to_units: str | None
) -> xr.DataArray:
    if not to_units or not from_units:
        return da
    converted = convert_units(
        np.asarray(da.values, dtype=np.float32), from_units, to_units
    )
    if converted is None:
        return da
    return xr.DataArray(converted, dims=da.dims, coords=da.coords, attrs=da.attrs)


def get_canonical_unit_policy(var_name: str) -> str | None:
    v = var_name.lower()
    temp_names = {
        "air_temperature",
        "surface_temperature",
        "dew_point_temperature",
        "road_temperature",
        "sea_surface_temperature",
    }
    if (
        v in temp_names
        or v.startswith("air_temperature_")
        or v.startswith("air_temperature_at_")
        or v.startswith("dew_point_temperature_")
    ):
        return "degC"
    pressure_names = {
        "air_pressure_at_sea_level",
        "air_pressure_at_surface",
        "surface_air_pressure",
        "mean_sea_level_pressure",
    }
    if v in pressure_names:
        return "hPa"
    return None


def parse_height_suffix(var_name: str) -> tuple[str, str | None]:
    if "_at_" not in var_name:
        return var_name, None
    base, _, suffix = var_name.rpartition("_at_")
    if suffix.endswith("m_agl"):
        return base, suffix
    return var_name, None


def get_range_spec(
    var_name: str,
    resolved: dict[str, dict[str, Any]] | None,
) -> tuple[str, dict[str, Any]] | None:
    if not resolved:
        return None
    if var_name in resolved:
        return var_name, resolved[var_name]
    base, height = parse_height_suffix(var_name)
    if height and base in resolved:
        spec = resolved[base]
        std_h = spec.get("standard_height")
        if std_h is None or str(std_h).lower() == height.lower():
            return base, spec
    canonical_map = {
        "air_temperature_at_2m_agl": "T2",
        "surface_temperature": "TSK",
        "air_pressure_at_sea_level": "MSLP",
        "mean_sea_level_pressure": "MSLP",
        "air_pressure_at_surface": "PSFC",
        "surface_air_pressure": "PSFC",
    }
    mapped = canonical_map.get(var_name)
    if mapped and mapped in resolved:
        return mapped, resolved[mapped]
    return None


def convert_units(
    values: np.ndarray, from_unit: str | None, to_unit: str | None
) -> np.ndarray | None:
    if from_unit is None or to_unit is None:
        return None
    f = from_unit.strip()
    t = to_unit.strip()
    if f == t:
        return values
    if f in ("K", "kelvin") and t in ("°C", "degC", "C"):
        return values - 273.15
    if f in ("°C", "degC", "C") and t in ("K", "kelvin"):
        return values + 273.15
    if f in ("Pa", "pascal") and t in ("hPa",):
        return values / 100.0
    if f in ("hPa",) and t in ("Pa", "pascal"):
        return values * 100.0
    if f in ("1", "fraction") and t in ("%",):
        return values * 100.0
    if f in ("%",) and t in ("1", "fraction"):
        return values / 100.0
    return None


def apply_clip(
    values: np.ndarray, clip: str | None, vmin: float, vmax: float
) -> np.ndarray:
    if not clip:
        return values
    clip_u = str(clip).upper()
    out = values
    if clip_u in ("LOW", "BOTH"):
        out = np.maximum(out, vmin)
    if clip_u in ("HIGH", "BOTH"):
        out = np.minimum(out, vmax)
    return out


def is_numeric_var(da: xr.DataArray) -> bool:
    return np.issubdtype(da.dtype, np.number)


def select_variables(
    ds: xr.Dataset,
    *,
    export_all: bool,
    include: list[str],
    exclude: list[str],
    single_var: str | None,
) -> list[str]:
    if export_all:
        candidates = []
        for name, da in ds.data_vars.items():
            if name in exclude:
                continue
            if not is_numeric_var(da):
                continue
            candidates.append(name)
        if include:
            candidates = [v for v in candidates if v in include]
        return sorted(candidates)
    if single_var:
        return [single_var]
    if include:
        return [v for v in include if v in ds.data_vars or can_derive_variable(v, ds)]
    return []


def has_wind_uv_10m_components(ds: xr.Dataset) -> bool:
    return WIND_U10_VAR in ds.data_vars and WIND_V10_VAR in ds.data_vars


def compute_auto_vector_scale(
    u_da: xr.DataArray,
    v_da: xr.DataArray,
    *,
    pmin: float,
    pmax: float,
    regridder: Any | None = None,
    max_samples: int = 1_000_000,
    per_frame: int = 100_000,
) -> tuple[float, float]:
    rng = np.random.default_rng(42)
    samples: list[np.ndarray] = []
    has_time = "Time" in u_da.dims
    n = int(u_da.sizes["Time"]) if has_time else 1

    for idx in range(n):
        u_slice = decode_to_float(u_da.isel(Time=idx) if has_time else u_da)
        v_slice = decode_to_float(v_da.isel(Time=idx) if has_time else v_da)
        if regridder is not None:
            u_slice = _regrid_with_mask(regridder, u_slice)
            v_slice = _regrid_with_mask(regridder, v_slice)
        merged = np.concatenate(
            [
                u_slice.values.astype(np.float32, copy=False).ravel(),
                v_slice.values.astype(np.float32, copy=False).ravel(),
            ]
        )
        merged = merged[np.isfinite(merged)]
        if merged.size == 0:
            continue
        if merged.size > per_frame:
            take = rng.choice(merged.size, size=per_frame, replace=False)
            merged = merged[take]
        samples.append(merged)
        if sum(s.size for s in samples) >= max_samples:
            break

    if not samples:
        raise ValueError("no finite values found for auto vector scaling")

    merged = np.concatenate(samples)
    lo = float(np.nanpercentile(merged, pmin))
    hi = float(np.nanpercentile(merged, pmax))
    if not np.isfinite(lo) or not np.isfinite(hi):
        raise ValueError("auto vector scale invalid: no finite percentiles")
    max_abs = max(abs(lo), abs(hi))
    if max_abs == 0.0:
        max_abs = 1e-6
    return -max_abs, max_abs


def build_vector_summary(
    *,
    variable: str,
    frames: int,
    elapsed: float,
    src_min: float,
    src_max: float,
    unit: str,
    title: str,
) -> dict[str, Any]:
    return {
        "variable": variable,
        "status": "ok",
        "frames": frames,
        "elapsed": elapsed,
        "src_min": float(src_min),
        "src_max": float(src_max),
        "unit": unit,
        "title": title,
        "default_layer": "vector",
    }


def compute_auto_scale(
    da: xr.DataArray,
    *,
    pmin: float,
    pmax: float,
    max_samples: int = 1_000_000,
    per_frame: int = 100_000,
    source_units: str | None = None,
    target_units: str | None = None,
    var_name: str | None = None,
) -> tuple[float, float]:
    rng = np.random.default_rng(42)
    samples: list[np.ndarray] = []
    name = var_name or (da.name if isinstance(da.name, str) else "")
    if "Time" in da.dims:
        n = int(da.sizes["Time"])
        for idx in range(n):
            arr = decode_to_float(
                da.isel(Time=idx), ignore_missing_zero=is_precip_variable(name)
            ).values.astype(np.float32, copy=False)
            if source_units and target_units:
                converted = convert_units(arr, source_units, target_units)
                if converted is not None:
                    arr = converted
            arr = arr[np.isfinite(arr)]
            if arr.size == 0:
                continue
            if arr.size > per_frame:
                take = rng.choice(arr.size, size=per_frame, replace=False)
                arr = arr[take]
            samples.append(arr)
            if sum(s.size for s in samples) >= max_samples:
                break
    else:
        arr = decode_to_float(
            da, ignore_missing_zero=is_precip_variable(name)
        ).values.astype(np.float32, copy=False)
        if source_units and target_units:
            converted = convert_units(arr, source_units, target_units)
            if converted is not None:
                arr = converted
        arr = arr[np.isfinite(arr)]
        if arr.size > max_samples:
            take = rng.choice(arr.size, size=max_samples, replace=False)
            arr = arr[take]
        samples.append(arr)
    if not samples:
        raise ValueError("no finite values found for auto scaling")
    merged = np.concatenate(samples)
    lo = float(np.nanpercentile(merged, pmin))
    hi = float(np.nanpercentile(merged, pmax))
    if not np.isfinite(lo) or not np.isfinite(hi):
        raise ValueError("auto scale invalid: no finite percentiles")
    if lo == hi:
        # This can happen for constant fields OR for discrete fields where the chosen
        # percentiles collapse to the same value (e.g., 99% of values are 0).
        vmin = float(np.nanmin(merged))
        vmax = float(np.nanmax(merged))
        if np.isfinite(vmin) and np.isfinite(vmax) and vmin < vmax:
            lo, hi = vmin, vmax
        else:
            # Constant field: create a tiny, non-zero range to avoid division by zero downstream.
            eps = max(1e-6, abs(lo) * 1e-6)
            hi = lo + eps
    return lo, hi


def compute_auto_scale_regridded(
    da: xr.DataArray,
    regridder: Any,
    *,
    pmin: float,
    pmax: float,
    max_samples: int = 1_000_000,
    per_frame: int = 100_000,
    source_units: str | None = None,
    target_units: str | None = None,
    var_name: str | None = None,
) -> tuple[float, float]:
    rng = np.random.default_rng(42)
    samples: list[np.ndarray] = []
    precip_name = var_name or (da.name if isinstance(da.name, str) else "")
    if "Time" in da.dims:
        n = int(da.sizes["Time"])
        for idx in range(n):
            raw_decoded = decode_to_float(
                da.isel(Time=idx), ignore_missing_zero=is_precip_variable(precip_name)
            )
            slice_da = raw_decoded
            if source_units and target_units:
                converted = convert_units(
                    slice_da.values.astype(np.float32), source_units, target_units
                )
                if converted is not None:
                    slice_da = slice_da.copy(data=converted)
            regridded = regrid_dataarray(
                regridder, slice_da, var_name=precip_name, debug=False
            )
            arr = regridded.values.astype(np.float32, copy=False)
            arr = arr[np.isfinite(arr)]
            if arr.size == 0:
                continue
            if arr.size > per_frame:
                take = rng.choice(arr.size, size=per_frame, replace=False)
                arr = arr[take]
            samples.append(arr)
            if sum(s.size for s in samples) >= max_samples:
                break
    else:
        decoded = decode_to_float(
            da, ignore_missing_zero=is_precip_variable(precip_name)
        )
        if source_units and target_units:
            converted = convert_units(
                decoded.values.astype(np.float32), source_units, target_units
            )
            if converted is not None:
                decoded = decoded.copy(data=converted)
        regridded = regrid_dataarray(regridder, decoded, var_name=precip_name, debug=False)
        arr = regridded.values.astype(np.float32, copy=False)
        arr = arr[np.isfinite(arr)]
        if arr.size > max_samples:
            take = rng.choice(arr.size, size=max_samples, replace=False)
            arr = arr[take]
        samples.append(arr)
    if not samples:
        raise ValueError("no finite values found for auto scaling")
    merged = np.concatenate(samples)
    lo = float(np.nanpercentile(merged, pmin))
    hi = float(np.nanpercentile(merged, pmax))
    if not np.isfinite(lo) or not np.isfinite(hi):
        raise ValueError("auto scale invalid: no finite percentiles")
    if lo == hi:
        # This can happen for constant fields OR for discrete fields where the chosen
        # percentiles collapse to the same value (e.g., 99% of values are 0).
        vmin = float(np.nanmin(merged))
        vmax = float(np.nanmax(merged))
        if np.isfinite(vmin) and np.isfinite(vmax) and vmin < vmax:
            lo, hi = vmin, vmax
        else:
            # Constant field: create a tiny, non-zero range to avoid division by zero downstream.
            eps = max(1e-6, abs(lo) * 1e-6)
            hi = lo + eps
    return lo, hi


def load_scale_config(path: str) -> dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("scale-config must be a JSON object")
    return data


def extract_scale_entry(entry: Any) -> tuple[float, float, str | None, str | None]:
    if isinstance(entry, list) and len(entry) == 2:
        return float(entry[0]), float(entry[1]), None, None
    if isinstance(entry, dict):
        if "min" not in entry or "max" not in entry:
            raise ValueError("scale-config object entry must have min and max")
        return (
            float(entry["min"]),
            float(entry["max"]),
            entry.get("unitOverride"),
            entry.get("titleOverride"),
        )
    raise ValueError("scale-config entry must be [min,max] or object with min/max")


def write_variables_catalog(
    out_root: Path,
    *,
    model: str,
    analysis_time: datetime,
    variables: list[dict[str, Any]],
) -> None:
    analysis_folder = analysis_time.strftime("%Y-%m-%d_%H")
    out_path = out_root / FORECAST_DATA_SUBDIR / model / analysis_folder / "variables.json"
    payload = {
        "schemaVersion": 1,
        "model": model,
        "analysis": analysis_folder,
        "variables": variables,
    }
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote variables catalog: {out_path}")


def write_models_catalog(out_root: Path, *, model: str) -> None:
    out_path = out_root / FORECAST_DATA_SUBDIR / "models.json"
    models: list[dict[str, Any]] = []
    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
            if isinstance(existing, dict) and isinstance(existing.get("models"), list):
                models = [m for m in existing["models"] if isinstance(m, dict)]
        except Exception:
            models = []
    if not any(m.get("id") == model for m in models):
        models.append({"id": model, "title": model, "default": len(models) == 0})
    payload = {"schemaVersion": 1, "models": models}
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote models catalog: {out_path}")


def write_analyses_catalog(
    out_root: Path, *, model: str, analysis_time: datetime
) -> None:
    model_dir = out_root / FORECAST_DATA_SUBDIR / model
    out_path = model_dir / "analyses.json"
    analysis_folder = analysis_time.strftime("%Y-%m-%d_%H")
    if model_dir.exists():
        analyses = sorted(
            [
                p.name
                for p in model_dir.iterdir()
                if p.is_dir()
                and len(p.name) == 13
                and p.name[4] == "-"
                and p.name[7] == "-"
                and p.name[10] == "_"
            ]
        )
    else:
        analyses = [analysis_folder]
    if analysis_folder not in analyses:
        analyses.append(analysis_folder)
        analyses = sorted(analyses)
    payload = {
        "schemaVersion": 1,
        "model": model,
        "analyses": analyses,
        "latest": analyses[-1],
    }
    model_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote analyses catalog: {out_path}")


def export_one_variable(
    input_path: str,
    variable: str,
    out_dir: str,
    *,
    model: str,
    analysis: datetime | None,
    history_interval: int | None,
    projection: str,
    bounds: list[float],
    coord_vars: dict[str, Any] | None,
    scale_mode: str,
    pmin: float,
    pmax: float,
    scale_entry: Any | None,
    scale_config_path: str | None,
    variables_spec: dict[str, dict[str, Any]] | None,
    require_yml_range: bool,
    scaling_policy: dict[str, Any] | None,
    require_policy_range: bool,
    fmt: str,
    isel: list[str],
    reduce_vertical: str | None,
    verbose: bool,
    target_bounds: list[float] | None,
    target_res_deg: float | None,
    target_shape: tuple[int, int] | None,
    detail_scale: float,
    regrid_method: str,
    weights_dir: str | None,
    no_regrid: bool,
    debug: bool,
    debug_one: bool,
) -> dict[str, Any]:
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    start = time.perf_counter()
    ds = xr.open_dataset(Path(input_path), mask_and_scale=False, decode_times=False)
    if variable not in ds.data_vars:
        derived = compute_derived_variable(variable, ds)
        if derived is None:
            return {"variable": variable, "status": "missing"}
        da = derived
    else:
        da = ds[variable]
        # When snow_fraction comes directly from the model output it carries no
        # rate masking.  Apply the same threshold mask that derive_snow_fraction()
        # uses so that symbols never appear over negligible precipitation.
        if variable == "snow_fraction":
            da = apply_snow_fraction_rate_mask(da, ds)
    if not is_numeric_var(da):
        return {"variable": variable, "status": "non-numeric"}

    # Apply extra dimension selection (excluding Time)
    isel_dict: dict[str, int] = {}
    for item in isel:
        dim, idx = parse_isel(item)
        if dim == "Time":
            raise ValueError(
                "--isel must not be used for Time; the exporter iterates over Time automatically"
            )
        isel_dict[dim] = idx
    if isel_dict:
        da = da.isel(**isel_dict)
    if reduce_vertical:
        da = reduce_extra_dims(da, reduce_vertical)

    if reduce_vertical is None:
        extra_dims = [
            d for d in da.dims if d not in ("Time", "south_north", "west_east")
        ]
        if extra_dims:
            return {
                "variable": variable,
                "status": "skipped-3d",
                "dims": ",".join(da.dims),
            }

    has_time = "Time" in da.dims
    n = int(da.sizes["Time"]) if has_time else 1

    # Allow the user to manually bypass regridding (useful for known-regular global grids)
    regrid = False if no_regrid else needs_regrid(ds, da)
    if debug:
        print(f"[{variable}] needs_regrid={regrid} method={regrid_method}")
    if regrid:
        if "XLAT" not in ds or "XLONG" not in ds:
            raise ValueError(
                "Regridding requires XLAT/XLONG variables in the NetCDF file."
            )
        if target_bounds is None:
            target_bounds = infer_target_bounds_from_xlatlon(ds)
        if detail_scale <= 0:
            raise ValueError("--detail-scale must be > 0")
        # Debug: compute original/adjusted grid details before building regridder.
        if debug:
            orig_shape = target_shape
            orig_res = target_res_deg
            if orig_shape is None and orig_res is None:
                lat2, _ = get_xlat_xlong_2d(ds, time_index=0)
                orig_shape = (int(lat2.shape[1]), int(lat2.shape[0]))
            adj_res = orig_res / detail_scale if orig_res is not None else None
            if orig_shape is not None:
                adj_w = max(1, int(round(orig_shape[0] * detail_scale)))
                adj_h = max(1, int(round(orig_shape[1] * detail_scale)))
            elif adj_res is not None:
                min_lon, min_lat, max_lon, max_lat = target_bounds
                adj_w = int(round((max_lon - min_lon) / adj_res)) + 1
                adj_h = int(round((max_lat - min_lat) / adj_res)) + 1
            else:
                adj_w = adj_h = 0
            if target_bounds is not None and adj_w > 0 and adj_h > 0:
                min_lon, min_lat, max_lon, max_lat = target_bounds
                lon_span = max_lon - min_lon
                lat_span = max_lat - min_lat
                px_per_deg_lon = adj_w / lon_span if lon_span else 0.0
                px_per_deg_lat = adj_h / lat_span if lat_span else 0.0
            else:
                px_per_deg_lon = px_per_deg_lat = 0.0
            print(
                f"[{variable}] detail-scale={detail_scale} "
                f"orig_shape={orig_shape} adj_shape={(adj_w, adj_h)} "
                f"orig_res_deg={orig_res} adj_res_deg={adj_res} "
                f"px_per_deg(lon,lat)=({px_per_deg_lon:.6g},{px_per_deg_lat:.6g})"
            )
        weights_path = Path(weights_dir) / model if weights_dir else None
        regridder, target_shape_out, _dst_lat_grid, _dst_lon_grid = build_regridder(
            ds,
            target_bounds=target_bounds,
            target_res_deg=target_res_deg,
            target_shape=target_shape,
            detail_scale=detail_scale,
            method=regrid_method,
            weights_dir=weights_path,
        )
    else:
        regridder = None
        target_shape_out = None
        _dst_lat_grid = None
        _dst_lon_grid = None
        if detail_scale != 1.0:
            print(
                f"[{variable}] detail-scale={detail_scale} ignored (no regridding active)"
            )
    domain_mask = None
    if regridder is not None:
        try:
            ignore_missing_zero = is_precip_variable(variable)
            if has_time:
                # Find the first timestep with any finite values to build a valid domain mask.
                mask_source = None
                for t_idx in range(n):
                    candidate = decode_to_float(
                        da.isel(Time=t_idx), ignore_missing_zero=ignore_missing_zero
                    )
                    try:
                        if np.isfinite(candidate.values).any():
                            mask_source = candidate
                            break
                    except Exception:
                        pass
                if mask_source is None:
                    mask_source = decode_to_float(
                        da.isel(Time=0), ignore_missing_zero=ignore_missing_zero
                    )
            else:
                mask_source = decode_to_float(
                    da, ignore_missing_zero=ignore_missing_zero
                )
            if mask_source.ndim == 2:
                domain_mask = build_regrid_domain_mask(regridder, mask_source)
                # If the regridder filled every cell (e.g. older xESMF without
                # unmapped_to_nan), the interpolated validity mask is all-True.
                # Fall back to a geometric convex-hull mask derived from the
                # source lat/lon grid to properly exclude outside-domain cells.
                if (
                    domain_mask is not None
                    and _dst_lat_grid is not None
                    and _dst_lon_grid is not None
                ):
                    mask_arr = np.asarray(domain_mask.values)
                    if mask_arr.mean() > 0.999:
                        try:
                            src_lat_grid, src_lon_grid = get_xlat_xlong_2d(ds, time_index=0)
                            dist_mask = _build_distance_domain_mask(
                                src_lat_grid.values,
                                src_lon_grid.values,
                                _dst_lat_grid,
                                _dst_lon_grid,
                            )
                            if dist_mask is not None and not dist_mask.all():
                                valid_frac = float(dist_mask.mean())
                                print(
                                    f"[{variable}] distance domain mask applied "
                                    f"(regridder mask was all-True); "
                                    f"valid fraction={valid_frac:.3f}"
                                )
                                domain_mask = xr.DataArray(
                                    dist_mask, dims=domain_mask.dims
                                )
                            else:
                                print(
                                    f"[{variable}] distance domain mask skipped "
                                    f"(dist_mask is None or all-True)"
                                )
                        except Exception as _mask_exc:
                            print(f"[{variable}] distance domain mask failed: {_mask_exc}")
                            pass  # leave the all-True mask if hull computation fails
        except Exception:
            domain_mask = None

    times = infer_times(ds, da) if has_time else infer_times_from_ds(ds)
    analysis_time = analysis or infer_analysis_time(ds, times)
    history_interval_minutes = history_interval or infer_history_interval_minutes(times)

    if not times and analysis_time and history_interval_minutes and has_time:
        times = [
            (analysis_time + timedelta(minutes=i * history_interval_minutes))
            .isoformat()
            .replace("+00:00", "Z")
            for i in range(n)
        ]
    elif not times and analysis_time and not has_time:
        times = [analysis_time.isoformat().replace("+00:00", "Z")]

    if analysis_time is None:
        raise ValueError(
            f"Could not infer analysis time for {variable}. Provide --analysis."
        )
    if history_interval_minutes is None and not times:
        raise ValueError(
            f"Could not infer history interval for {variable} and no times array available. "
            "Provide --history_interval."
        )

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    prefix = f"{variable}_"

    unit = da.attrs.get("units")
    title = da.attrs.get("description") or da.attrs.get("long_name") or variable
    canonical_policy = get_canonical_unit_policy(variable)
    spec_match = get_range_spec(variable, variables_spec)
    yml_key = None
    yml_spec: dict[str, Any] | None = None
    if spec_match:
        yml_key, yml_spec = spec_match
    policy_match = get_scaling_policy(variable, scaling_policy)
    policy_key = None
    policy_spec: dict[str, Any] | None = None
    if policy_match:
        policy_key, policy_spec = policy_match

    policy_src_min = policy_src_max = None
    policy_units = None
    policy_clip = None
    policy_image_unscale = None
    policy_image_scale: str | None = None
    if policy_spec:
        policy_src_min = policy_spec.get("srcMin")
        policy_src_max = policy_spec.get("srcMax")
        policy_units = policy_spec.get("canonical_units") or policy_spec.get(
            "canonicalUnits"
        )
        policy_clip = policy_spec.get("clip")
        policy_image_unscale = policy_spec.get("imageUnscale")
        policy_image_scale = policy_spec.get("imageScale") or None
        if not (
            isinstance(policy_src_min, (int, float))
            and isinstance(policy_src_max, (int, float))
        ):
            policy_src_min = policy_src_max = None
        if policy_image_unscale is not None and not (
            isinstance(policy_image_unscale, list) and len(policy_image_unscale) == 2
        ):
            policy_image_unscale = None

    yml_min = yml_max = None
    yml_units = None
    yml_clip = None
    if yml_spec:
        yml_min = yml_spec.get("min")
        yml_max = yml_spec.get("max")
        yml_units = yml_spec.get("units")
        yml_clip = yml_spec.get("clip")
        if not (
            isinstance(yml_min, (int, float)) and isinstance(yml_max, (int, float))
        ):
            yml_min = yml_max = None

    source_units = da.attrs.get("units") or policy_units or yml_units
    target_units = policy_units or (
        "°C"
        if canonical_policy == "degC"
        else "hPa" if canonical_policy == "hPa" else None
    )

    if policy_src_min is not None and policy_src_max is not None:
        src_min, src_max = float(policy_src_min), float(policy_src_max)
        unit = target_units or unit
        scaling_meta = {
            "mode": "policy_yml",
            "policyFile": "manifest_scaling_v2.yml",
            "matchedVariable": policy_key,
            "canonicalUnits": unit,
        }
    elif yml_min is not None and yml_max is not None:
        target_unit = target_units or yml_units
        converted = convert_units(
            np.array([yml_min, yml_max], dtype=np.float32), yml_units, target_unit
        )
        if converted is None:
            if require_yml_range:
                raise ValueError(
                    f"{variable}: cannot convert YAML units {yml_units} -> {target_unit}"
                )
            if debug:
                print(
                    f"[{variable}] YAML range ignored (unit conversion {yml_units} -> {target_unit} unsupported)"
                )
            yml_min = yml_max = None
        else:
            yml_min, yml_max = float(converted[0]), float(converted[1])
            unit = target_unit or unit
            scaling_meta = {
                "mode": "variables_yml",
                "key": yml_key,
                "canonicalUnits": unit,
                "source": "variables.yml",
            }
    elif require_policy_range:
        raise ValueError(f"{variable}: no usable policy range")
    elif require_yml_range:
        raise ValueError(f"{variable}: no usable YAML range")

    if policy_src_min is not None and policy_src_max is not None:
        src_min, src_max = src_min, src_max
    elif yml_min is not None and yml_max is not None:
        src_min, src_max = yml_min, yml_max
    elif scale_mode == "fixed":
        if scale_entry is None:
            raise ValueError(f"Missing scale config for variable '{variable}'")
        src_min, src_max, unit_override, title_override = extract_scale_entry(
            scale_entry
        )
        if unit_override:
            unit = unit_override
        if title_override:
            title = title_override
        scaling_meta = {"mode": "fixed", "source": scale_config_path or "scale-config"}
    else:
        if regridder is None:
            src_min, src_max = compute_auto_scale(
                da,
                pmin=pmin,
                pmax=pmax,
                source_units=source_units,
                target_units=target_units,
                var_name=variable,
            )
        else:
            src_min, src_max = compute_auto_scale_regridded(
                da,
                regridder,
                pmin=pmin,
                pmax=pmax,
                source_units=source_units,
                target_units=target_units,
                var_name=variable,
            )
        scaling_meta = {"mode": "auto", "pmin": pmin, "pmax": pmax}

    if debug:
        print(
            f"[{variable}] units={unit} canonical={canonical_policy} policy_key={policy_key} "
            f"yml_key={yml_key} yml_minmax={yml_min},{yml_max} src_min={src_min:.6g} "
            f"src_max={src_max:.6g} clip={policy_clip or yml_clip}"
        )

    width = height = None
    debug_dir = Path(out_dir) / "_debug" if (debug or debug_one) else None
    if debug_dir is not None:
        debug_dir.mkdir(parents=True, exist_ok=True)

    if has_time:
        time_indices = [0] if debug_one else range(n)
        for idx in time_indices:
            raw_decoded = decode_to_float(
                da.isel(Time=idx), ignore_missing_zero=is_precip_variable(variable)
            )
            if target_units and source_units:
                converted = convert_units(
                    raw_decoded.values.astype(np.float32), source_units, target_units
                )
                if converted is not None:
                    raw_decoded = xr.DataArray(
                        converted,
                        dims=raw_decoded.dims,
                        coords=raw_decoded.coords,
                        attrs=raw_decoded.attrs,
                    )
                    unit = target_units
            slice_da = raw_decoded
            if slice_da.ndim != 2:
                raise ValueError(
                    f"{variable}: Time={idx} expected 2D array, got shape={slice_da.shape} dims={slice_da.dims}. "
                    "Use --isel DIM=INDEX or --reduce-vertical for extra dimensions."
                )
            if debug:
                mv = [
                    da.attrs.get(k)
                    for k in ("missing_value", "_FillValue")
                    if k in da.attrs
                ]
                print(
                    _summarize_array(
                        f"{variable}:raw[t={idx}]", slice_da.values, missing_values=mv
                    )
                )
            if regridder is not None:
                if domain_mask is not None:
                    slice_da = regrid_dataarray(
                        regridder, slice_da, var_name=variable, debug=debug
                    )
                    mask_np = np.asarray(domain_mask.values)
                    slice_vals = np.asarray(slice_da.values)
                    if mask_np.shape == slice_vals.shape:
                        slice_da = slice_da.copy(
                            data=np.where(mask_np, slice_vals, np.nan)
                        )
                    else:
                        slice_da = regrid_dataarray(
                            regridder, slice_da, var_name=variable, debug=debug
                        )
                else:
                    slice_da = regrid_dataarray(
                        regridder, slice_da, var_name=variable, debug=debug
                    )
            clip_mode = policy_clip or yml_clip
            clip_min = policy_src_min if policy_src_min is not None else yml_min
            clip_max = policy_src_max if policy_src_max is not None else yml_max
            if clip_mode and clip_min is not None and clip_max is not None:
                slice_vals = np.asarray(slice_da.values, dtype=np.float32)
                slice_vals = apply_clip(
                    slice_vals, clip_mode, float(clip_min), float(clip_max)
                )
                slice_da = slice_da.copy(data=slice_vals)
                if debug:
                    finite_pct = (
                        float(np.sum(np.isfinite(slice_da.values)))
                        / slice_da.values.size
                        * 100.0
                    )
                    print(
                        f"[{variable}] regrid shape={slice_da.values.shape} finite%={finite_pct:.2f}"
                    )
                    print(
                        _summarize_array(f"{variable}:regrid[t={idx}]", slice_da.values)
                    )
            img = make_image(
                slice_da,
                src_min,
                src_max,
                domain_mask=(domain_mask.values if domain_mask is not None else None),
                image_scale=policy_image_scale,
            )
            if width is None or height is None:
                width, height = img.size
            if debug:
                arr = np.asarray(slice_da.values, dtype=np.float32)
                mv = [
                    da.attrs.get(k)
                    for k in ("missing_value", "_FillValue")
                    if k in da.attrs
                ]
                mask = ~np.isfinite(arr)
                for mv_val in mv:
                    try:
                        mask |= arr == mv_val
                    except Exception:
                        pass
                masked_count = int(np.sum(mask))
                scaled = (arr - src_min) / (src_max - src_min) * 255.0
                scaled = np.clip(scaled, 0, 255).astype(np.uint8)
                finite = np.isfinite(arr)
                if finite.any():
                    uniq = np.unique(scaled[finite])
                    uniq_count = int(min(len(uniq), 50))
                else:
                    uniq_count = 0
                print(
                    f"[{variable}] scaled uint8 min={int(scaled.min())} max={int(scaled.max())} "
                    f"uniq~={uniq_count} masked={masked_count}"
                )
            if debug_one:
                np.save(debug_dir / "raw.npy", np.asarray(raw_decoded.values))
                np.save(debug_dir / "regridded.npy", np.asarray(slice_da.values))
            # scaled preview
            if debug_one:
                arr = np.asarray(slice_da.values, dtype=np.float32)
                scaled = (arr - src_min) / (src_max - src_min) * 255.0
                scaled = np.clip(scaled, 0, 255).astype(np.uint8)
                np.save(debug_dir / "scaled.npy", scaled)
                Image.fromarray(np.flipud(scaled), mode="L").save(
                    debug_dir / "scaled_preview.png"
                )
            fname = f"{prefix}{idx:03d}.{fmt.lower()}"
            save_image(img, out_path / fname, fmt=fmt, verbose=verbose)
    else:
        if da.ndim != 2:
            raise ValueError(
                f"{variable}: expected 2D array, got shape={da.shape} dims={da.dims}. "
                "Use --isel DIM=INDEX or --reduce-vertical for extra dimensions."
            )
        da_decoded = decode_to_float(
            da, ignore_missing_zero=is_precip_variable(variable)
        )
        if target_units and source_units:
            converted = convert_units(
                da_decoded.values.astype(np.float32), source_units, target_units
            )
            if converted is not None:
                da_decoded = xr.DataArray(
                    converted,
                    dims=da_decoded.dims,
                    coords=da_decoded.coords,
                    attrs=da_decoded.attrs,
                )
                unit = target_units
        if debug:
            mv = [
                da.attrs.get(k)
                for k in ("missing_value", "_FillValue")
                if k in da.attrs
            ]
            print(
                _summarize_array(
                    f"{variable}:raw", da_decoded.values, missing_values=mv
                )
            )
        if regridder is not None:
            if domain_mask is not None:
                da_decoded = regrid_dataarray(
                    regridder, da_decoded, var_name=variable, debug=debug
                )
                mask_np = np.asarray(domain_mask.values)
                vals = np.asarray(da_decoded.values)
                if mask_np.shape == vals.shape:
                    da_decoded = da_decoded.copy(data=np.where(mask_np, vals, np.nan))
                else:
                    da_decoded = regrid_dataarray(
                        regridder, da_decoded, var_name=variable, debug=debug
                    )
            else:
                da_decoded = regrid_dataarray(
                    regridder, da_decoded, var_name=variable, debug=debug
                )
        clip_mode = policy_clip or yml_clip
        clip_min = policy_src_min if policy_src_min is not None else yml_min
        clip_max = policy_src_max if policy_src_max is not None else yml_max
        if clip_mode and clip_min is not None and clip_max is not None:
            vals = np.asarray(da_decoded.values, dtype=np.float32)
            vals = apply_clip(vals, clip_mode, float(clip_min), float(clip_max))
            da_decoded = da_decoded.copy(data=vals)
            if debug:
                finite_pct = (
                    float(np.sum(np.isfinite(da_decoded.values)))
                    / da_decoded.values.size
                    * 100.0
                )
                print(
                    f"[{variable}] regrid shape={da_decoded.values.shape} finite%={finite_pct:.2f}"
                )
                print(_summarize_array(f"{variable}:regrid", da_decoded.values))
        img = make_image(
            da_decoded,
            src_min,
            src_max,
            domain_mask=(domain_mask.values if domain_mask is not None else None),
            image_scale=policy_image_scale,
        )
        width, height = img.size
        if debug:
            arr = np.asarray(da_decoded.values, dtype=np.float32)
            mv = [
                da.attrs.get(k)
                for k in ("missing_value", "_FillValue")
                if k in da.attrs
            ]
            mask = ~np.isfinite(arr)
            for mv_val in mv:
                try:
                    mask |= arr == mv_val
                except Exception:
                    pass
            masked_count = int(np.sum(mask))
            scaled = (arr - src_min) / (src_max - src_min) * 255.0
            scaled = np.clip(scaled, 0, 255).astype(np.uint8)
            finite = np.isfinite(arr)
            if finite.any():
                uniq = np.unique(scaled[finite])
                uniq_count = int(min(len(uniq), 50))
            else:
                uniq_count = 0
            print(
                f"[{variable}] scaled uint8 min={int(scaled.min())} max={int(scaled.max())} "
                f"uniq~={uniq_count} masked={masked_count}"
            )
        if debug_one:
            np.save(debug_dir / "raw.npy", np.asarray(da_decoded.values))
            np.save(debug_dir / "regridded.npy", np.asarray(da_decoded.values))
            arr = np.asarray(da_decoded.values, dtype=np.float32)
            scaled = (arr - src_min) / (src_max - src_min) * 255.0
            scaled = np.clip(scaled, 0, 255).astype(np.uint8)
            np.save(debug_dir / "scaled.npy", scaled)
            Image.fromarray(np.flipud(scaled), mode="L").save(
                debug_dir / "scaled_preview.png"
            )
        fname = f"{prefix}000.{fmt.lower()}"
        save_image(img, out_path / fname, fmt=fmt, verbose=verbose)

    manifest_bounds = target_bounds if regrid else bounds
    if regrid and target_shape_out and (width is None or height is None):
        width, height = target_shape_out
    image_unscale_out = (
        [float(x) for x in policy_image_unscale]
        if policy_image_unscale is not None
        else [float(src_min), float(src_max)]
    )
    write_manifest(
        out_path,
        dataset_id=variable,
        title=title,
        variable=variable,
        unit=unit,
        projection="EPSG:4326" if regrid else projection,
        bounds=manifest_bounds,
        src_min=src_min,
        src_max=src_max,
        image_unscale=image_unscale_out,
        image_scale=policy_image_scale,
        fmt=fmt,
        prefix=prefix,
        count=n,
        width=width or 0,
        height=height or 0,
        times=times,
        analysis_time=analysis_time,
        history_interval_minutes=history_interval_minutes,
        coord_vars=coord_vars,
        flip_y_applied=True,
        scaling=scaling_meta,
        detail_scale=detail_scale,
        target_width=width,
        target_height=height,
    )
    elapsed = time.perf_counter() - start
    return {
        "variable": variable,
        "status": "ok",
        "frames": n,
        "elapsed": elapsed,
        "src_min": float(src_min),
        "src_max": float(src_max),
        "unit": unit,
        "title": title,
        "default_layer": "raster",
    }


def export_wind_uv_dataset(
    input_path: str,
    out_dir: str,
    *,
    model: str,
    analysis: datetime | None,
    history_interval: int | None,
    projection: str,
    bounds: list[float],
    coord_vars: dict[str, Any] | None,
    pmin: float,
    pmax: float,
    fmt: str,
    target_bounds: list[float] | None,
    target_res_deg: float | None,
    target_shape: tuple[int, int] | None,
    detail_scale: float,
    regrid_method: str,
    weights_dir: str | None,
    no_regrid: bool,
    debug: bool,
    debug_one: bool,
    vector_scale: tuple[float, float] | None,
) -> dict[str, Any]:
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    start = time.perf_counter()
    ds = xr.open_dataset(Path(input_path), mask_and_scale=False, decode_times=False)
    if not has_wind_uv_10m_components(ds):
        return {"variable": WIND_UV10_DATASET, "status": "missing-components"}

    u_da = ds[WIND_U10_VAR]
    v_da = ds[WIND_V10_VAR]
    if u_da.dims != v_da.dims:
        raise ValueError(f"Wind component dims mismatch: {u_da.dims} vs {v_da.dims}")
    if u_da.shape != v_da.shape:
        raise ValueError(f"Wind component shape mismatch: {u_da.shape} vs {v_da.shape}")

    for name, da in ((WIND_U10_VAR, u_da), (WIND_V10_VAR, v_da)):
        extra_dims = [d for d in da.dims if d not in ("Time", "south_north", "west_east")]
        if extra_dims:
            return {
                "variable": WIND_UV10_DATASET,
                "status": "skipped-3d",
                "dims": ",".join(da.dims),
            }

    has_time = "Time" in u_da.dims
    n = int(u_da.sizes["Time"]) if has_time else 1

    regrid = False if no_regrid else needs_regrid(ds, u_da)
    if regrid:
        if "XLAT" not in ds or "XLONG" not in ds:
            raise ValueError("Regridding requires XLAT/XLONG variables in the NetCDF file.")
        if target_bounds is None:
            target_bounds = infer_target_bounds_from_xlatlon(ds)
        weights_path = Path(weights_dir) / model if weights_dir else None
        regridder, target_shape_out, _dst_lat_grid_uv, _dst_lon_grid_uv = build_regridder(
            ds,
            target_bounds=target_bounds,
            target_res_deg=target_res_deg,
            target_shape=target_shape,
            detail_scale=detail_scale,
            method=regrid_method,
            weights_dir=weights_path,
        )
    else:
        regridder = None
        target_shape_out = None
        _dst_lat_grid_uv = None
        _dst_lon_grid_uv = None
        if detail_scale != 1.0:
            print(f"[{WIND_UV10_DATASET}] detail-scale={detail_scale} ignored (no regridding active)")

    times = infer_times(ds, u_da) if has_time else infer_times_from_ds(ds)
    analysis_time = analysis or infer_analysis_time(ds, times)
    history_interval_minutes = history_interval or infer_history_interval_minutes(times)
    if not times and analysis_time and history_interval_minutes and has_time:
        times = [
            (analysis_time + timedelta(minutes=i * history_interval_minutes))
            .isoformat()
            .replace("+00:00", "Z")
            for i in range(n)
        ]
    elif not times and analysis_time and not has_time:
        times = [analysis_time.isoformat().replace("+00:00", "Z")]
    if analysis_time is None:
        raise ValueError(f"Could not infer analysis time for {WIND_UV10_DATASET}. Provide --analysis.")
    if history_interval_minutes is None and not times:
        raise ValueError(
            f"Could not infer history interval for {WIND_UV10_DATASET} and no times array available. "
            "Provide --history_interval."
        )

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    prefix = f"{WIND_UV10_DATASET}_"

    if vector_scale is not None:
        max_abs = max(abs(float(vector_scale[0])), abs(float(vector_scale[1])))
        if max_abs == 0.0:
            raise ValueError("--vector-scale invalid: symmetric range cannot be zero")
        src_min, src_max = -max_abs, max_abs
        scaling_meta = {"mode": "fixed", "source": "--vector-scale", "symmetric": True}
    else:
        src_min, src_max = compute_auto_vector_scale(
            u_da, v_da, pmin=pmin, pmax=pmax, regridder=regridder
        )
        scaling_meta = {"mode": "auto", "pmin": pmin, "pmax": pmax, "symmetric": True}

    # Build a distance-based domain mask for the vector layer.  This mirrors the
    # scalar pipeline's fallback: when the regridder fills every destination cell
    # (e.g. older xESMF without unmapped_to_nan, or domains whose convex hull
    # covers the full bounding box) _regrid_with_mask leaves no NaN pixels and
    # make_vector_image produces an all-255-alpha image that is saved as plain
    # RGB — losing all domain-boundary information.  The distance mask sets
    # out-of-domain cells to NaN so the resulting WebP retains its RGBA alpha
    # channel and the frontend can use it for masking.
    _vec_domain_mask: "np.ndarray | None" = None
    if regridder is not None and _dst_lat_grid_uv is not None and _dst_lon_grid_uv is not None:
        try:
            # Try regridder-based mask first.
            _test_src = decode_to_float(u_da.isel(Time=0) if has_time else u_da)
            _regrid_mask = build_regrid_domain_mask(regridder, _test_src)
            if _regrid_mask is not None and np.asarray(_regrid_mask.values).mean() > 0.999:
                # Regridder fills everything — fall back to distance heuristic.
                src_lat_grid_uv, src_lon_grid_uv = get_xlat_xlong_2d(ds, time_index=0)
                dist_mask_uv = _build_distance_domain_mask(
                    src_lat_grid_uv.values,
                    src_lon_grid_uv.values,
                    _dst_lat_grid_uv,
                    _dst_lon_grid_uv,
                )
                if dist_mask_uv is not None and not dist_mask_uv.all():
                    _vec_domain_mask = dist_mask_uv
                    print(
                        f"[{WIND_UV10_DATASET}] distance domain mask applied "
                        f"(regridder mask was all-True); "
                        f"valid fraction={float(_vec_domain_mask.mean()):.3f}"
                    )
            elif _regrid_mask is not None:
                _vec_domain_mask = np.asarray(_regrid_mask.values, dtype=bool)
        except Exception as _vdm_exc:
            print(f"[{WIND_UV10_DATASET}] vector domain mask failed: {_vdm_exc}")

    width = height = None
    time_indices = [0] if debug_one else range(n)
    for idx in time_indices:
        u_slice = decode_to_float(u_da.isel(Time=idx) if has_time else u_da)
        v_slice = decode_to_float(v_da.isel(Time=idx) if has_time else v_da)
        if regridder is not None:
            u_slice = _regrid_with_mask(regridder, u_slice)
            v_slice = _regrid_with_mask(regridder, v_slice)
        # Apply the distance-based domain mask if the regridder didn't NaN
        # the outside-domain pixels on its own.
        if _vec_domain_mask is not None:
            u_arr = np.where(_vec_domain_mask, u_slice.values, np.nan).astype(np.float32)
            v_arr = np.where(_vec_domain_mask, v_slice.values, np.nan).astype(np.float32)
            u_slice = u_slice.copy(data=u_arr)
            v_slice = v_slice.copy(data=v_arr)
        valid_mask = np.isfinite(u_slice.values) & np.isfinite(v_slice.values)
        u_vals = np.asarray(u_slice.values, dtype=np.float32)
        v_vals = np.asarray(v_slice.values, dtype=np.float32)
        u_slice = u_slice.copy(data=np.where(valid_mask, u_vals, np.nan))
        v_slice = v_slice.copy(data=np.where(valid_mask, v_vals, np.nan))
        img = make_vector_image(u_slice, v_slice, src_min, src_max)
        if width is None or height is None:
            width, height = img.size
        fname = f"{prefix}{idx:03d}.{fmt.lower()}"
        save_image(img, out_path / fname, fmt=fmt, verbose=debug)

    manifest_bounds = target_bounds if regrid else bounds
    if regrid and target_shape_out and (width is None or height is None):
        width, height = target_shape_out
    write_manifest(
        out_path,
        dataset_id=WIND_UV10_DATASET,
        title="10m wind (u/v, true)",
        variable=WIND_UV10_DATASET,
        unit="m/s",
        projection="EPSG:4326" if regrid else projection,
        bounds=manifest_bounds,
        src_min=src_min,
        src_max=src_max,
        image_unscale=[float(src_min), float(src_max)],
        fmt=fmt,
        prefix=prefix,
        count=n,
        width=width or 0,
        height=height or 0,
        times=times,
        analysis_time=analysis_time,
        history_interval_minutes=history_interval_minutes,
        coord_vars=coord_vars,
        flip_y_applied=True,
        scaling=scaling_meta,
        detail_scale=detail_scale,
        target_width=width,
        target_height=height,
        encoding={
            "kind": "vector",
            "dtype": "uint8",
            "valueChannels": {"u": "R", "v": "G"},
            "nodata": "A==0",
        },
    )
    elapsed = time.perf_counter() - start
    return build_vector_summary(
        variable=WIND_UV10_DATASET,
        frames=n,
        elapsed=elapsed,
        src_min=src_min,
        src_max=src_max,
        unit="m/s",
        title="10m wind (u/v, true)",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert NetCDF variables to per-timestep images (WebP/PNG)."
    )
    parser.add_argument("-i", "--input", required=True, help="Path to NetCDF file")
    parser.add_argument(
        "--export-all", action="store_true", help="Export all numeric data variables"
    )
    parser.add_argument(
        "--include",
        action="append",
        default=[],
        help="Variable allowlist (repeatable or comma-separated)",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Variable denylist (repeatable or comma-separated)",
    )
    parser.add_argument(
        "--list-vars", action="store_true", help="List candidate variables and exit"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned exports without writing files",
    )
    parser.add_argument("--model", default=None, help="Model id (e.g. GFS, GWES, RAP)")
    parser.add_argument("--out-root", default=None, help="Output root directory")
    parser.add_argument(
        "--analysis",
        type=parse_analysis_time,
        default=None,
        help="Analysis time YYYY-MM-DD_hh",
    )
    parser.add_argument(
        "--history_interval",
        type=parse_positive_int,
        default=None,
        help="Time step minutes",
    )
    parser.add_argument(
        "--scale-mode", choices=["auto", "fixed"], default="auto", help="Scaling mode"
    )
    parser.add_argument(
        "--pmin",
        type=float,
        default=0.0,
        help="Auto scaling lower percentile (default: 0 = full range)",
    )
    parser.add_argument(
        "--pmax",
        type=float,
        default=100.0,
        help="Auto scaling upper percentile (default: 100 = full range)",
    )
    parser.add_argument(
        "--scale-config", default=None, help="Scale config JSON (fixed mode)"
    )
    parser.add_argument(
        "--variables-yml", default=None, help="Variables.yml for fixed ranges and units"
    )
    parser.add_argument(
        "--require-yml-range",
        action="store_true",
        help="Fail if no YAML range is found for an exported variable",
    )
    parser.add_argument(
        "--scaling-policy-yml",
        default=None,
        help="Scaling policy manifest_scaling_v2.yml",
    )
    parser.add_argument(
        "--require-policy-range",
        action="store_true",
        help="Fail if no scaling policy match exists for an exported variable",
    )
    parser.add_argument(
        "--emit-scale-config", default=None, help="Write computed scales to JSON"
    )
    parser.add_argument(
        "--vector-scale",
        type=parse_scale,
        default=None,
        help="Fixed symmetric scale [min,max] for derived vector exports",
    )
    parser.add_argument(
        "--keep-components",
        action="store_true",
        help="When generating derived vector exports, also export the source scalar components",
    )
    parser.add_argument(
        "--jobs", type=int, default=1, help="Parallel jobs (default: 1)"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Verbose per-frame logging"
    )
    parser.add_argument(
        "--reduce-vertical",
        choices=["first", "max", "mean"],
        default=None,
        help="Reduce extra dims (e.g. bottom_top) to 2D before export. If omitted, 3D vars are skipped.",
    )
    parser.add_argument(
        "--debug", action="store_true", help="Print debug statistics for each variable"
    )
    parser.add_argument(
        "--debug-one",
        action="store_true",
        help="Process only one variable and Time=0 with debug dumps",
    )
    parser.add_argument(
        "--target-bounds",
        type=parse_bounds,
        default=None,
        help="Target bounds for regridding",
    )
    parser.add_argument(
        "--target-res-deg",
        type=float,
        default=None,
        help="Target resolution in degrees",
    )
    parser.add_argument(
        "--target-shape",
        type=parse_shape,
        default=None,
        help="Target shape width,height",
    )
    parser.add_argument(
        "--detail-scale",
        type=float,
        default=1.0,
        help="Scale target grid density for regridded output (default: 1.0)",
    )
    parser.add_argument(
        "--regrid-method",
        choices=["bilinear", "nearest"],
        default="bilinear",
        help="Regridding method (default: bilinear)",
    )
    parser.add_argument(
        "--no-regrid",
        action="store_true",
        help="Disable regridding even if XLAT/XLONG or projection metadata are present (manual override).",
    )
    parser.add_argument(
        "--print-grid-info",
        action="store_true",
        help="Print detected grid/bounds/regridding decisions and exit (use with --variable/--include/--export-all).",
    )
    parser.add_argument(
        "--weights-dir",
        default=None,
        help="Directory to cache xESMF weight files (default: <out-root>/.xesmf_weights)",
    )
    parser.add_argument(
        "-v", "--variable", default=None, help="Single variable name (optional)"
    )
    parser.add_argument("--format", default="WEBP", help="Image format (default: WEBP)")
    parser.add_argument(
        "--isel",
        action="append",
        default=[],
        help="Select additional dimensions before export, e.g. --isel bottom_top=0 (repeatable)",
    )
    parser.add_argument(
        "--projection",
        default="EPSG:4326",
        help="Projection string (default: EPSG:4326)",
    )
    parser.add_argument(
        "--bounds",
        type=parse_bounds,
        default=None,
        help="Explicit bounds [minLon,minLat,maxLon,maxLat]",
    )
    parser.add_argument(
        "--lat-var", default="XLAT", help="Latitude variable name (default: XLAT)"
    )
    parser.add_argument(
        "--lon-var", default="XLONG", help="Longitude variable name (default: XLONG)"
    )
    parser.add_argument(
        "--config",
        default=None,
        help="Path to YAML config file (keys match long option names with underscores)",
    )

    # Load config file defaults before full parse so CLI args still take precedence.
    _pre, _ = parser.parse_known_args()
    if _pre.config:
        with open(_pre.config, "r", encoding="utf-8") as _fh:
            _cfg = yaml.safe_load(_fh) or {}
        if not isinstance(_cfg, dict):
            parser.error(f"Config file {_pre.config!r} must be a YAML mapping")
        # Drop null values so they don't override argparse defaults.
        _cfg = {k: v for k, v in _cfg.items() if v is not None}
        # Resolve relative paths inside the config relative to the config file's
        # own directory, not the current working directory.  This lets config
        # files use portable relative paths like "./weights" or
        # "./manifest_scaling_v2.yml" regardless of where the script is invoked.
        _cfg_dir = os.path.dirname(os.path.abspath(_pre.config))
        # Only resolve paths that reference other config/policy files (not
        # operational output paths like weights_dir or out_root, which are
        # intentionally relative to wherever the user invokes the script).
        _path_keys = {"scaling_policy_yml", "variables_yml"}
        for _key in _path_keys:
            if _key in _cfg and isinstance(_cfg[_key], str):
                _cfg[_key] = os.path.normpath(os.path.join(_cfg_dir, _cfg[_key]))
        parser.set_defaults(**_cfg)

    args = parser.parse_args()

    if not args.model:
        parser.error("--model is required (or set via --config)")
    if not args.out_root:
        parser.error("--out-root is required (or set via --config)")

    def split_csv(values: list[str]) -> list[str]:
        parts: list[str] = []
        for value in values:
            for chunk in value.split(","):
                item = chunk.strip()
                if item:
                    parts.append(item)
        return parts

    include_list = split_csv(args.include)
    exclude_list = split_csv(args.exclude)

    in_path = Path(args.input)
    out_root = Path(args.out_root)
    weights_dir = args.weights_dir or str(out_root / ".xesmf_weights")
    ds = xr.open_dataset(in_path, mask_and_scale=True, decode_times=False)
    default_analysis_time = args.analysis or infer_analysis_time(
        ds, infer_times_from_ds(ds)
    )
    target_bounds = args.target_bounds
    if target_bounds is None and ("XLAT" in ds and "XLONG" in ds):
        target_bounds = infer_target_bounds_from_xlatlon(ds)

    if args.list_vars:
        rows = list_candidate_vars(ds)
        print("name\tdims\tdtype\tunits")
        for name, dims, dtype, unit in rows:
            print(f"{name}\t{dims}\t{dtype}\t{unit}")
        return 0

    default_excludes = {"Times", "XLAT", "XLONG"}
    exclude = set(default_excludes)
    exclude.update(exclude_list)

    variables = select_variables(
        ds,
        export_all=args.export_all,
        include=include_list,
        exclude=list(exclude),
        single_var=args.variable,
    )
    if not variables:
        raise ValueError(
            "No variables selected. Use --export-all, --variable, or --include."
        )

    scale_config = (
        load_scale_config(args.scale_config) if args.scale_mode == "fixed" else {}
    )
    if args.scale_mode == "fixed" and not args.scale_config:
        raise ValueError("--scale-config is required when --scale-mode fixed")

    coord_vars: dict[str, Any] | None = None
    bounds = args.bounds
    if bounds is None:
        bi = infer_bounds(ds, lat_var=args.lat_var, lon_var=args.lon_var, time_index=0)
        if bi is None:
            bounds = [-180.0, -90.0, 180.0, 90.0]
            coord_vars = {
                "lat": args.lat_var,
                "lon": args.lon_var,
                "inferred": False,
                "note": "Bounds not found; defaulted to global",
            }
            print(
                "WARNING: Could not infer bounds; defaulting to global bounds. Use --bounds for accuracy."
            )
        else:
            bounds = bi.bounds
            coord_vars = {
                "lat": bi.lat_var,
                "lon": bi.lon_var,
                "inferred": True,
                "normalizedLon": bi.normalized_lon,
            }

    if args.debug and "XLAT" in ds and "XLONG" in ds:
        try:
            xlat = ds["XLAT"]
            xlong = ds["XLONG"]
            lat2, lon2 = get_xlat_xlong_2d(ds, time_index=0)
            print(f"[grid] XLAT dims={xlat.dims} shape={xlat.shape}")
            print(f"[grid] XLONG dims={xlong.dims} shape={xlong.shape}")
            print(
                f"[grid] XLAT has Time={'Time' in xlat.dims} XLONG has Time={'Time' in xlong.dims}"
            )
            print(f"[grid] XLAT 2D shape={lat2.shape} XLONG 2D shape={lon2.shape}")
        except Exception as e:
            print(f"[grid] XLAT/XLONG inspection failed: {e}")
        if bounds is not None:
            print(f"[grid] inferred bounds={bounds}")

    if args.print_grid_info:
        print(
            _summarize_grid_info(
                ds,
                variables,
                bounds=bounds,
                coord_vars=coord_vars,
                no_regrid=args.no_regrid,
            )
        )
        return 0

    variables_spec = None
    if args.variables_yml:
        variables_spec = resolve_aliases(load_variables_yml(args.variables_yml))
    scaling_policy = None
    if args.scaling_policy_yml:
        scaling_policy = load_scaling_policy(args.scaling_policy_yml)
        validate_policy(scaling_policy)

    if args.debug or args.debug_one:
        args.jobs = 1

    emitted_scales: dict[str, list[float]] = {}
    jobs = args.jobs if args.jobs > 0 else (os.cpu_count() or 1)
    selected_var_set = set(variables)
    generate_wind_uv = has_wind_uv_10m_components(ds) and (
        args.export_all
        or {WIND_U10_VAR, WIND_V10_VAR}.issubset(selected_var_set)
    )

    def build_out_dir(analysis_time: datetime, var_name: str) -> Path:
        analysis_folder = analysis_time.strftime("%Y-%m-%d_%H")
        return out_root / FORECAST_DATA_SUBDIR / args.model / analysis_folder / var_name

    tasks: list[dict[str, Any]] = []
    for var_name in variables:
        if (
            generate_wind_uv
            and not args.keep_components
            and var_name in {WIND_U10_VAR, WIND_V10_VAR}
        ):
            print(f"Skipping scalar component in favor of derived vector export: {var_name}")
            continue
        if var_name not in ds.data_vars:
            if can_derive_variable(var_name, ds):
                pass  # will be computed inside export_one_variable
            else:
                print(f"Skipping missing variable: {var_name}")
                continue
        elif not is_numeric_var(ds[var_name]):
            print(f"Skipping non-numeric variable: {var_name}")
            continue
        if args.reduce_vertical is None and var_name in ds.data_vars:
            extra_dims = [
                d
                for d in ds[var_name].dims
                if d not in ("Time", "south_north", "west_east")
            ]
            if extra_dims:
                dims = ",".join(ds[var_name].dims)
                print(
                    f"Skipping 3D variable (no --reduce-vertical): {var_name} dims={dims}"
                )
                continue
        scale_entry = scale_config.get(var_name) if args.scale_mode == "fixed" else None
        tasks.append({"kind": "scalar", "variable": var_name, "scale_entry": scale_entry})

    if generate_wind_uv:
        tasks.append({"kind": "vector", "variable": WIND_UV10_DATASET, "scale_entry": None})

    def run_task(task: dict[str, Any], *, verbose_override: bool | None = None, debug_one: bool = False) -> dict[str, Any]:
        analysis_time = default_analysis_time
        if analysis_time is None:
            raise ValueError("Could not infer analysis time. Provide --analysis.")
        out_dir = build_out_dir(analysis_time, task["variable"])
        if task["kind"] == "vector":
            return export_wind_uv_dataset(
                input_path=str(in_path),
                out_dir=str(out_dir),
                model=args.model,
                analysis=args.analysis,
                history_interval=args.history_interval,
                projection=args.projection,
                bounds=bounds,
                coord_vars=coord_vars,
                pmin=args.pmin,
                pmax=args.pmax,
                fmt=args.format,
                target_bounds=target_bounds,
                target_res_deg=args.target_res_deg,
                target_shape=args.target_shape,
                detail_scale=args.detail_scale,
                regrid_method=args.regrid_method,
                weights_dir=weights_dir,
                no_regrid=args.no_regrid,
                debug=args.debug or debug_one,
                debug_one=debug_one,
                vector_scale=args.vector_scale,
            )
        return export_one_variable(
            input_path=str(in_path),
            variable=task["variable"],
            out_dir=str(out_dir),
            model=args.model,
            analysis=args.analysis,
            history_interval=args.history_interval,
            projection=args.projection,
            bounds=bounds,
            coord_vars=coord_vars,
            scale_mode=args.scale_mode,
            pmin=args.pmin,
            pmax=args.pmax,
            scale_entry=task["scale_entry"],
            scale_config_path=args.scale_config,
            variables_spec=variables_spec,
            require_yml_range=args.require_yml_range,
            scaling_policy=scaling_policy,
            require_policy_range=args.require_policy_range,
            fmt=args.format,
            isel=args.isel,
            reduce_vertical=args.reduce_vertical,
            verbose=args.verbose if verbose_override is None else verbose_override,
            target_bounds=target_bounds,
            target_res_deg=args.target_res_deg,
            target_shape=args.target_shape,
            detail_scale=args.detail_scale,
            regrid_method=args.regrid_method,
            weights_dir=weights_dir,
            no_regrid=args.no_regrid,
            debug=args.debug or debug_one,
            debug_one=debug_one,
        )

    summaries: list[dict[str, Any]] = []
    start_all = time.perf_counter()
    if args.dry_run:
        analysis_time = default_analysis_time
        if analysis_time is None:
            raise ValueError("Could not infer analysis time. Provide --analysis.")
        for task in tasks:
            out_dir = build_out_dir(analysis_time, task["variable"])
            scale_desc = "vector-auto" if task["kind"] == "vector" and args.vector_scale is None else (
                "vector-fixed" if task["kind"] == "vector" else args.scale_mode
            )
            print(f"[DRY RUN] {task['variable']} -> {out_dir} (scale: {scale_desc})")
        return 0
    if args.debug_one:
        if not tasks:
            raise ValueError("No variables selected for debug-one.")
        summary = run_task(tasks[0], verbose_override=True, debug_one=True)
        summaries.append(summary)
    elif jobs == 1 or len(tasks) == 1:
        for task in tasks:
            summary = run_task(task, debug_one=False)
            summaries.append(summary)
            if summary.get("status") == "ok":
                emitted_scales[summary["variable"]] = [summary["src_min"], summary["src_max"]]
    else:
        with ProcessPoolExecutor(max_workers=jobs) as executor:
            futures = []
            analysis_time = default_analysis_time
            if analysis_time is None:
                raise ValueError("Could not infer analysis time. Provide --analysis.")
            for task in tasks:
                out_dir = build_out_dir(analysis_time, task["variable"])
                if task["kind"] == "vector":
                    futures.append(
                        executor.submit(
                            export_wind_uv_dataset,
                            str(in_path),
                            str(out_dir),
                            model=args.model,
                            analysis=args.analysis,
                            history_interval=args.history_interval,
                            projection=args.projection,
                            bounds=bounds,
                            coord_vars=coord_vars,
                            pmin=args.pmin,
                            pmax=args.pmax,
                            fmt=args.format,
                            target_bounds=target_bounds,
                            target_res_deg=args.target_res_deg,
                            target_shape=args.target_shape,
                            detail_scale=args.detail_scale,
                            regrid_method=args.regrid_method,
                            weights_dir=weights_dir,
                            no_regrid=args.no_regrid,
                            debug=args.debug,
                            debug_one=False,
                            vector_scale=args.vector_scale,
                        )
                    )
                else:
                    futures.append(
                        executor.submit(
                            export_one_variable,
                            str(in_path),
                            task["variable"],
                            str(out_dir),
                            model=args.model,
                            analysis=args.analysis,
                            history_interval=args.history_interval,
                            projection=args.projection,
                            bounds=bounds,
                            coord_vars=coord_vars,
                            scale_mode=args.scale_mode,
                            pmin=args.pmin,
                            pmax=args.pmax,
                            scale_entry=task["scale_entry"],
                            scale_config_path=args.scale_config,
                            variables_spec=variables_spec,
                            require_yml_range=args.require_yml_range,
                            scaling_policy=scaling_policy,
                            require_policy_range=args.require_policy_range,
                            fmt=args.format,
                            isel=args.isel,
                            reduce_vertical=args.reduce_vertical,
                            verbose=args.verbose,
                            target_bounds=target_bounds,
                            target_res_deg=args.target_res_deg,
                            target_shape=args.target_shape,
                            detail_scale=args.detail_scale,
                            regrid_method=args.regrid_method,
                            weights_dir=weights_dir,
                            no_regrid=args.no_regrid,
                            debug=args.debug,
                            debug_one=False,
                        )
                    )
            for fut in as_completed(futures):
                summary = fut.result()
                summaries.append(summary)
                if summary.get("status") == "ok":
                    emitted_scales[summary["variable"]] = [
                        summary["src_min"],
                        summary["src_max"],
                    ]

    elapsed_all = time.perf_counter() - start_all
    ok = [s for s in summaries if s.get("status") == "ok"]
    failed = [s for s in summaries if s.get("status") not in ("ok", "skipped-3d")]
    skipped = [s for s in summaries if s.get("status") == "skipped-3d"]
    print(f"Export complete: {len(ok)} ok, {len(failed)} failed in {elapsed_all:.1f}s")
    for s in ok:
        print(f"  OK {s['variable']} ({s['frames']} frames) {s['elapsed']:.1f}s")
    for s in failed:
        print(f"  FAIL {s.get('variable')} ({s.get('status')})")
    for s in skipped:
        dims = s.get("dims", "")
        print(f"  SKIP {s.get('variable')} (3D dims: {dims})")

    if ok:
        analysis_time = default_analysis_time
        if analysis_time is None:
            raise ValueError("Could not infer analysis time. Provide --analysis.")
        vars_payload = [
            {
                "id": s["variable"],
                "title": s.get("title") or s["variable"],
                "unit": s.get("unit"),
                "manifest": f"{s['variable']}/manifest.json",
                "defaultLayer": s.get("default_layer", "raster"),
            }
            for s in ok
        ]
        write_models_catalog(out_root, model=args.model)
        write_analyses_catalog(out_root, model=args.model, analysis_time=analysis_time)
        write_variables_catalog(
            out_root,
            model=args.model,
            analysis_time=analysis_time,
            variables=vars_payload,
        )

    if args.emit_scale_config:
        Path(args.emit_scale_config).write_text(
            json.dumps(emitted_scales, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote scale config: {args.emit_scale_config}")

    if failed:
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, argparse.ArgumentTypeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
