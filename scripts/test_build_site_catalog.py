"""Tests for build_site_catalog. Run: python -m unittest discover -s scripts"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest import mock

import build_site_catalog
from build_site_catalog import build_site_catalog as build

CATALOG = {
    "schemaVersion": 1,
    "models": [
        {"id": "A", "title": "Model A", "default": True, "bbox": {"west": 0, "south": 0, "east": 1, "north": 1}},
        {"id": "B", "title": "Model B", "default": False, "preferred": True},
        "C",
        {"id": "D", "title": "Model D", "default": False, "view": {"center": [0, 60], "zoom": 5}},
    ],
}


def ids(catalog):
    return [m["id"] for m in catalog["models"]]


def default(catalog):
    return [m["id"] for m in catalog["models"] if m["default"]]


class BuildSiteCatalog(unittest.TestCase):
    def test_keeps_only_the_listed_models_in_the_site_order(self):
        result, missing = build(CATALOG, {"models": ["D", "B"]})
        self.assertEqual(ids(result), ["D", "B"])
        self.assertEqual(missing, [])

    def test_keeps_catalog_fields_and_lets_the_site_replace_them(self):
        result, _ = build(CATALOG, {"models": [{"id": "D", "title": "Site D"}, "A"]})
        d, a = result["models"]
        self.assertEqual(d["title"], "Site D")
        self.assertEqual(d["view"], CATALOG["models"][3]["view"])
        self.assertEqual(a["bbox"], CATALOG["models"][0]["bbox"])

    def test_keeps_top_level_fields(self):
        result, _ = build(CATALOG, {"models": ["A"]})
        self.assertEqual(result["schemaVersion"], 1)

    def test_turns_a_bare_catalog_id_into_an_entry(self):
        result, _ = build(CATALOG, {"models": ["C"]})
        self.assertEqual(result["models"], [{"id": "C", "title": "C", "default": True}])

    def test_the_site_default_replaces_the_catalog_default(self):
        result, _ = build(CATALOG, {"models": ["A", {"id": "B", "default": True}]})
        self.assertEqual(default(result), ["B"])

    def test_without_a_site_default_the_first_model_is_the_default(self):
        result, _ = build(CATALOG, {"models": ["D", "A"]})
        self.assertEqual(default(result), ["D"])

    def test_a_missing_default_falls_back_to_the_first_model(self):
        result, missing = build(CATALOG, {"models": ["B", {"id": "X", "default": True}]})
        self.assertEqual(default(result), ["B"])
        self.assertEqual(missing, ["X"])

    def test_reports_listed_models_the_catalog_lacks(self):
        result, missing = build(CATALOG, {"models": ["X", "A", "Y"]})
        self.assertEqual(ids(result), ["A"])
        self.assertEqual(missing, ["X", "Y"])

    def test_refuses_a_site_with_none_of_its_models_in_the_catalog(self):
        with self.assertRaisesRegex(ValueError, "none of the site's models"):
            build(CATALOG, {"models": ["X"]})

    def test_refuses_malformed_site_files(self):
        for site, message in [
            (None, "no `models` list"),
            ({"models": "A"}, "no `models` list"),
            ({"models": [{"title": "no id"}]}, "without an id"),
            ({"models": ["A", {"id": "A"}]}, "more than once"),
            ({"models": [{"id": "A", "default": True}, {"id": "B", "default": True}]}, "more than one default"),
        ]:
            with self.subTest(site=site), self.assertRaisesRegex(ValueError, message):
                build(CATALOG, site)

    def test_refuses_a_catalog_without_models(self):
        with self.assertRaisesRegex(ValueError, "catalog has no `models` list"):
            build({"schemaVersion": 1}, {"models": ["A"]})


class Main(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.root = Path(self.dir.name)
        self.catalog = self.root / "models.json"
        self.catalog.write_text(json.dumps(CATALOG), encoding="utf-8")
        self.site = self.root / "site.yml"

    def tearDown(self):
        self.dir.cleanup()

    def run_main(self, *args):
        stdout, stderr = io.StringIO(), io.StringIO()
        argv = ["build_site_catalog.py", str(self.catalog), str(self.site), *args]
        with mock.patch.object(sys, "argv", argv), redirect_stdout(stdout), redirect_stderr(stderr):
            rc = build_site_catalog.main()
        return rc, stdout.getvalue(), stderr.getvalue()

    def test_writes_the_site_catalog_to_out(self):
        self.site.write_text("models:\n  - id: B\n    default: true\n  - A\n", encoding="utf-8")
        out = self.root / "site-models.json"
        rc, stdout, _ = self.run_main("--out", str(out))
        self.assertEqual(rc, 0)
        self.assertEqual(stdout, "")
        result = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual((ids(result), default(result)), (["B", "A"], ["B"]))

    def test_prints_to_stdout_and_warns_about_missing_models(self):
        self.site.write_text("models: [A, X]\n", encoding="utf-8")
        rc, stdout, stderr = self.run_main()
        self.assertEqual(rc, 0)
        self.assertEqual(ids(json.loads(stdout)), ["A"])
        self.assertIn("X is not in", stderr)

    def test_fails_without_writing_on_a_bad_site_file(self):
        self.site.write_text("models: [X]\n", encoding="utf-8")
        out = self.root / "site-models.json"
        rc, _, stderr = self.run_main("--out", str(out))
        self.assertEqual(rc, 1)
        self.assertIn("ERROR", stderr)
        self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
