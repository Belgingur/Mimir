"""
Model coverage for models.json: where a model has data, and how fine its grid is.

The viewer uses these fields to choose a model for a reader's location, to say
when a model does not cover the view, to cap zoom at the grid's resolution and
to show that resolution in the model chooser. All of it can be read from the
catalog itself, so nobody has to keep it up to date by hand:

  bbox           the union of the variables' manifest bounds
  domain_mask    which cells of the bbox hold data, read from the alpha channel
                 of each variable's first frame (alpha 0 is nodata); left out
                 when the data fills the bbox
  resolution_km  the grid's north-south spacing, from bounds and image height;
                 only filled in when the entry has none, so a model's published
                 figure, once written by hand, is kept

A bbox alone is not enough. A domain on a Lambert or rotated grid is reprojected
into a lat/lon box much larger than its data, so the box would claim places the
model knows nothing about.

netcdf2image.py writes these fields as it converts a model, and
build_model_coverage.py fills them in for a catalog that already exists. Every
other field of a models.json entry (title, default, preferred, view, ...) is
left as it was.

Mask encoding, as the viewer reads it (src/lib/domainMask.ts): the bbox is cut
into `cols` x `rows` equal cells, row 0 at the north edge. `runs` lists each
row's alternating run lengths, nodata first, with rows separated by "/" and runs
by ".". A row's cells after its last run are nodata.
"""

from __future__ import annotations

import io
import json
import math
from collections.abc import Callable, Iterable
from typing import Any

import numpy as np
from PIL import Image

#: Mask cells along the longer side of a model's grid.
DEFAULT_MASK_CELLS = 160

#: Kilometres per degree of latitude.
KM_PER_DEGREE_LAT = 111.32

#: Fields refreshed from the data on every run.
REFRESHED_FIELDS = ("bbox", "domain_mask")

#: Reads a file by its path relative to the forecast-data root.
Fetch = Callable[[str], bytes]


def manifest_size(manifest: dict[str, Any]) -> tuple[int, int] | None:
    """(width, height) of a manifest's frames; `shape` is a dict or [w, h]."""
    shape = manifest.get("shape")
    if isinstance(shape, dict):
        width, height = shape.get("width"), shape.get("height")
    elif isinstance(shape, (list, tuple)) and len(shape) == 2:
        width, height = shape
    else:
        return None
    if not width or not height:
        return None
    return int(width), int(height)


def grid_spacing_km(manifest: dict[str, Any]) -> float | None:
    """
    The grid's spacing in km. North-south spacing is the same everywhere on a
    lat/lon image, where east-west spacing shrinks towards the poles, so it is
    the honest single number for a whole domain.
    """
    rendering = manifest.get("rendering") or {}
    meters = rendering.get("resolutionMeters")
    if isinstance(meters, (int, float)) and meters > 0:
        return round(meters / 1000, 1)
    bounds = manifest.get("bounds")
    size = manifest_size(manifest)
    if not bounds or len(bounds) != 4 or not size:
        return None
    lat_span = abs(float(bounds[3]) - float(bounds[1]))
    return round(lat_span * KM_PER_DEGREE_LAT / size[1], 1)


def data_pixels(frame: Image.Image) -> np.ndarray | None:
    """Boolean array of the pixels holding data, or None when all of them do."""
    if "A" not in frame.getbands():
        return None
    alpha = np.asarray(frame.getchannel("A"))
    has_data = alpha > 0
    return None if has_data.all() else has_data


def encode_mask(has_data: np.ndarray, cells: int = DEFAULT_MASK_CELLS) -> dict[str, Any]:
    """
    Downsample a pixel mask to at most `cells` cells along its longer side and
    run-length encode it. A cell holds data when at least half of its pixels do.
    """
    height, width = has_data.shape
    step = max(1, math.ceil(max(width, height) / cells))
    rows, cols = math.ceil(height / step), math.ceil(width / step)
    padded = np.full((rows * step, cols * step), np.nan, dtype=np.float32)
    padded[:height, :width] = has_data
    blocks = padded.reshape(rows, step, cols, step)
    share = np.nanmean(blocks, axis=(1, 3))
    covered = share >= 0.5
    return {"cols": cols, "rows": rows, "runs": "/".join(_row_runs(r) for r in covered)}


def _row_runs(row: np.ndarray) -> str:
    runs: list[int] = []
    current, length = False, 0
    for valid in row:
        if bool(valid) == current:
            length += 1
        else:
            runs.append(length)
            current, length = bool(valid), 1
    runs.append(length)
    if len(runs) % 2 == 1 and len(runs) > 1:
        runs.pop()  # a trailing nodata run is implied
    return ".".join(str(n) for n in runs)


def model_coverage(
    fetch: Fetch,
    model: str,
    analysis: str,
    manifest_paths: Iterable[str],
    *,
    cells: int = DEFAULT_MASK_CELLS,
) -> dict[str, Any]:
    """
    Coverage fields for one run of a model, from its variables' manifests and
    first frames. `manifest_paths` are relative to the run's directory, as
    variables.json lists them ("air_temperature/manifest.json").

    The mask is the union of every variable's data: a wave variable has data
    only over the sea, so a model's domain is wherever any of its variables
    reaches. It is written only when every variable shares one grid; variables
    on different grids give a bbox that spans them all, and no mask.
    """
    grids: dict[tuple, list[np.ndarray | None]] = {}
    union: list[float] | None = None
    spacing: float | None = None
    for path in manifest_paths:
        manifest = json.loads(fetch(f"{model}/{analysis}/{path}"))
        bounds = [float(v) for v in manifest["bounds"]]
        union = (
            bounds
            if union is None
            else [min(union[0], bounds[0]), min(union[1], bounds[1]),
                  max(union[2], bounds[2]), max(union[3], bounds[3])]
        )
        spacing = spacing or grid_spacing_km(manifest)
        size = manifest_size(manifest)
        frame_name = manifest["fileTemplate"].replace("{index:03d}", "000")
        frame_dir = path.rsplit("/", 1)[0] if "/" in path else ""
        frame_path = f"{model}/{analysis}/{frame_dir}/{frame_name}".replace("//", "/")
        frame = Image.open(io.BytesIO(fetch(frame_path)))
        frame.load()
        grids.setdefault((tuple(bounds), size), []).append(data_pixels(frame))

    if union is None:
        raise ValueError(f"{model} {analysis}: no variables to read coverage from")

    coverage: dict[str, Any] = {
        "bbox": dict(zip(("west", "south", "east", "north"), (round(v, 3) for v in union))),
    }
    if spacing is not None:
        coverage["resolution_km"] = spacing

    if len(grids) == 1:
        masks = next(iter(grids.values()))
        # A variable with no nodata anywhere means the whole grid has data.
        if all(m is not None for m in masks):
            combined = np.logical_or.reduce(masks)
            if not combined.all():
                coverage["domain_mask"] = encode_mask(combined, cells)
    return coverage


def merge_coverage(entry: dict[str, Any], coverage: dict[str, Any]) -> dict[str, Any]:
    """
    A models.json entry with its coverage brought up to date. bbox and
    domain_mask are replaced; a mask from an earlier run is dropped when this
    run has none, since the data now fills the bbox. resolution_km is added only
    when the entry has none. Every other field is kept, and every field keeps
    its place, so converting the same model again rewrites the same bytes.
    """
    merged: dict[str, Any] = {}
    for key, value in entry.items():
        if key not in REFRESHED_FIELDS:
            merged[key] = value
        elif key in coverage:
            merged[key] = coverage[key]
    for key in REFRESHED_FIELDS:
        if key in coverage and key not in merged:
            merged[key] = coverage[key]
    if merged.get("resolution_km") is None and "resolution_km" in coverage:
        merged["resolution_km"] = coverage["resolution_km"]
    return merged
