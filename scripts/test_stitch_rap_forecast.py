"""Tests for stitch_rap_forecast. Run: python -m unittest discover -s scripts"""

from __future__ import annotations

import io
import json
import tempfile
import threading
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path

import stitch_rap_forecast as stitch

MODEL = "RAP"
VARIABLES = ("air_temperature_at_2m_agl", "wind_uv_10m")


def write_run(root: Path, analysis: str, count: int, variables=VARIABLES) -> None:
    analysis_time = datetime.strptime(analysis, "%Y-%m-%d_%H").replace(tzinfo=timezone.utc)
    for variable in variables:
        variable_dir = root / MODEL / analysis / variable
        variable_dir.mkdir(parents=True, exist_ok=True)
        for index in range(count):
            (variable_dir / f"{variable}_{index:03d}.webp").write_bytes(b"x")
        manifest = {
            "projection": "EPSG:4326",
            "bounds": [0, 0, 1, 1],
            "shape": {"width": 1, "height": 1},
            "srcMin": 0,
            "srcMax": 1,
            "imageUnscale": [0, 1],
            "format": "webp",
            "fileTemplate": f"{variable}_{{index:03d}}.webp",
            "count": count,
            "times": [(analysis_time + timedelta(hours=h)).isoformat() for h in range(count)],
            "analysisTime": analysis,
        }
        (variable_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


def manifest(root: Path, analysis: str, variable: str = VARIABLES[0]) -> dict:
    return json.loads((root / MODEL / analysis / variable / "manifest.json").read_text(encoding="utf-8"))


class StitchRun(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.root = Path(self.dir.name)
        stitch.POLL_SECONDS = 0.05

    def tearDown(self):
        self.dir.cleanup()

    def run_stitch(self, analysis: str, wait_seconds: float = 0) -> None:
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            stitch.stitch_run(self.root, MODEL, analysis, "hardlink", False, False, wait_seconds)

    def test_stitches_the_tail_of_the_long_run_from_the_hour_before(self):
        write_run(self.root, "2026-10-27_15", 52)
        write_run(self.root, "2026-10-27_16", 22)
        self.run_stitch("2026-10-27_16")
        stitched = manifest(self.root, "2026-10-27_16")
        self.assertEqual(stitched["count"], 51)
        self.assertEqual(stitched["stitchedForecast"]["tailSourceAnalysis"], "2026-10-27_15")

    def test_never_falls_back_to_a_long_run_older_than_five_hours(self):
        write_run(self.root, "2026-10-27_09", 52)
        (self.root / MODEL / "2026-10-27_15").mkdir(parents=True)  # conversion just started
        write_run(self.root, "2026-10-27_16", 22)
        with self.assertRaisesRegex(RuntimeError, "from 1–5 h before"):
            self.run_stitch("2026-10-27_16")
        self.assertEqual(manifest(self.root, "2026-10-27_16")["count"], 22)

    def test_waits_for_every_variable_of_a_long_run_still_being_written(self):
        write_run(self.root, "2026-10-27_09", 52)
        write_run(self.root, "2026-10-27_15", 52, variables=VARIABLES[:1])
        write_run(self.root, "2026-10-27_16", 22)
        late = threading.Timer(0.2, write_run, (self.root, "2026-10-27_15", 52, VARIABLES[1:]))
        late.start()
        try:
            self.run_stitch("2026-10-27_16", wait_seconds=5)
        finally:
            late.join()
        for variable in VARIABLES:
            self.assertEqual(manifest(self.root, "2026-10-27_16", variable)["count"], 51)

    def test_stitches_what_is_there_once_the_wait_is_over(self):
        write_run(self.root, "2026-10-27_15", 52, variables=VARIABLES[:1])
        write_run(self.root, "2026-10-27_16", 22)
        self.run_stitch("2026-10-27_16", wait_seconds=0.1)
        self.assertEqual(manifest(self.root, "2026-10-27_16", VARIABLES[0])["count"], 51)
        self.assertEqual(manifest(self.root, "2026-10-27_16", VARIABLES[1])["count"], 22)


if __name__ == "__main__":
    unittest.main()
