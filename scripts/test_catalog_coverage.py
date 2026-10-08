"""Tests for catalog_coverage. Run: python -m unittest discover -s scripts"""

from __future__ import annotations

import io
import json
import unittest

import numpy as np
from PIL import Image

from catalog_coverage import (
    encode_mask,
    grid_spacing_km,
    merge_coverage,
    model_coverage,
)


def webp(has_data: np.ndarray | None, size: tuple[int, int] = (4, 2)) -> bytes:
    """A frame whose alpha is 0 where `has_data` is false; RGB when None."""
    width, height = size
    if has_data is None:
        image = Image.new("RGB", (width, height), (128, 128, 128))
    else:
        alpha = np.where(has_data, 255, 0).astype(np.uint8)
        grey = np.full_like(alpha, 128)
        image = Image.fromarray(np.stack([grey, alpha], axis=-1), mode="LA")
    out = io.BytesIO()
    image.save(out, format="WEBP", lossless=True)
    return out.getvalue()


def catalog(variables: dict[str, tuple[list[float], np.ndarray | None]]):
    """An in-memory run of model M, one frame per variable, and its fetch()."""
    files: dict[str, bytes] = {}
    for name, (bounds, has_data) in variables.items():
        height, width = has_data.shape if has_data is not None else (2, 4)
        manifest = {
            "bounds": bounds,
            "shape": {"width": width, "height": height},
            "fileTemplate": f"{name}_{{index:03d}}.webp",
        }
        files[f"M/run/{name}/manifest.json"] = json.dumps(manifest).encode()
        files[f"M/run/{name}/{name}_000.webp"] = webp(has_data, (width, height))
    return files.__getitem__, [f"{name}/manifest.json" for name in variables]


class GridSpacing(unittest.TestCase):
    def test_reads_the_north_south_spacing_from_bounds_and_height(self):
        # 0.25° rows: GFS's grid.
        manifest = {"bounds": [-180, -90, 179.75, 90], "shape": {"width": 1440, "height": 720}}
        self.assertEqual(grid_spacing_km(manifest), 27.8)

    def test_accepts_a_width_height_list(self):
        self.assertEqual(grid_spacing_km({"bounds": [0, 0, 1, 1], "shape": [10, 10]}), 11.1)

    def test_prefers_a_declared_resolution(self):
        manifest = {"bounds": [0, 0, 1, 1], "shape": [10, 10], "rendering": {"resolutionMeters": 2500}}
        self.assertEqual(grid_spacing_km(manifest), 2.5)

    def test_is_none_without_a_shape(self):
        self.assertIsNone(grid_spacing_km({"bounds": [0, 0, 1, 1]}))


class EncodeMask(unittest.TestCase):
    def test_matches_the_viewer_decoder_fixture(self):
        # The same mask is decoded in tests/domainMask.test.ts.
        has_data = np.array([[0, 1, 1, 0], [0, 0, 0, 0]], dtype=bool)
        self.assertEqual(encode_mask(has_data, cells=4), {"cols": 4, "rows": 2, "runs": "1.2/4"})

    def test_starts_each_row_with_a_nodata_run(self):
        has_data = np.array([[1, 1, 0, 1]], dtype=bool)
        self.assertEqual(encode_mask(has_data, cells=4)["runs"], "0.2.1.1")

    def test_counts_a_cell_as_covered_when_half_its_pixels_are(self):
        has_data = np.array([[1, 0, 0, 0], [1, 0, 0, 0]], dtype=bool)
        mask = encode_mask(has_data, cells=2)
        self.assertEqual((mask["cols"], mask["rows"]), (2, 1))
        self.assertEqual(mask["runs"], "0.1")

    def test_pads_a_grid_that_does_not_divide_evenly(self):
        has_data = np.ones((3, 5), dtype=bool)
        mask = encode_mask(has_data, cells=2)
        self.assertEqual((mask["cols"], mask["rows"]), (2, 1))
        self.assertEqual(mask["runs"], "0.2")


class ModelCoverage(unittest.TestCase):
    BOUNDS = [-10.0, 50.0, 10.0, 60.0]

    def test_unions_the_data_of_every_variable(self):
        land = np.array([[1, 1, 0, 0], [0, 0, 0, 0]], dtype=bool)
        sea = np.array([[0, 0, 1, 0], [0, 0, 0, 0]], dtype=bool)
        fetch, paths = catalog({"t2m": (self.BOUNDS, land), "waves": (self.BOUNDS, sea)})
        coverage = model_coverage(fetch, "M", "run", paths, cells=4)
        self.assertEqual(coverage["bbox"], {"west": -10.0, "south": 50.0, "east": 10.0, "north": 60.0})
        self.assertEqual(coverage["resolution_km"], 556.6)
        self.assertEqual(coverage["domain_mask"]["runs"], "0.3/4")

    def test_has_no_mask_when_the_data_fills_the_bbox(self):
        fetch, paths = catalog({"t2m": (self.BOUNDS, None)})
        self.assertNotIn("domain_mask", model_coverage(fetch, "M", "run", paths))

    def test_has_no_mask_when_one_variable_fills_the_grid(self):
        partial = np.array([[1, 0, 0, 0], [0, 0, 0, 0]], dtype=bool)
        fetch, paths = catalog({"t2m": (self.BOUNDS, None), "waves": (self.BOUNDS, partial)})
        self.assertNotIn("domain_mask", model_coverage(fetch, "M", "run", paths))

    def test_spans_variables_on_different_grids_without_a_mask(self):
        partial = np.array([[1, 0, 0, 0], [0, 0, 0, 0]], dtype=bool)
        fetch, paths = catalog(
            {"t2m": (self.BOUNDS, partial), "waves": ([0.0, 40.0, 20.0, 55.0], partial)}
        )
        coverage = model_coverage(fetch, "M", "run", paths)
        self.assertEqual(coverage["bbox"], {"west": -10.0, "south": 40.0, "east": 20.0, "north": 60.0})
        self.assertNotIn("domain_mask", coverage)

    def test_refuses_a_run_with_no_variables(self):
        with self.assertRaises(ValueError):
            model_coverage(lambda path: b"", "M", "run", [])


class MergeCoverage(unittest.TestCase):
    ENTRY = {
        "id": "M",
        "title": "Model M",
        "default": True,
        "preferred": True,
        "view": {"center": [0, 55], "zoom": 4},
        "bbox": {"west": 0, "south": 0, "east": 1, "north": 1},
        "domain_mask": {"cols": 1, "rows": 1, "runs": "0.1"},
    }

    def test_keeps_every_field_it_does_not_own(self):
        merged = merge_coverage(self.ENTRY, {"bbox": {"west": -1}})
        for field in ("id", "title", "default", "preferred", "view"):
            self.assertEqual(merged[field], self.ENTRY[field])

    def test_replaces_the_bbox_and_drops_a_mask_the_data_no_longer_needs(self):
        merged = merge_coverage(self.ENTRY, {"bbox": {"west": -1}})
        self.assertEqual(merged["bbox"], {"west": -1})
        self.assertNotIn("domain_mask", merged)

    def test_fills_in_a_missing_resolution(self):
        self.assertEqual(merge_coverage(self.ENTRY, {"resolution_km": 2.1})["resolution_km"], 2.1)

    def test_keeps_a_resolution_written_by_hand(self):
        entry = {**self.ENTRY, "resolution_km": 3.2}
        self.assertEqual(merge_coverage(entry, {"resolution_km": 3.5})["resolution_km"], 3.2)


if __name__ == "__main__":
    unittest.main()
