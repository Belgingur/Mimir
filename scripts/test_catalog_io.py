"""Tests for catalog_io. Run: python -m unittest discover -s scripts"""

from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path

from catalog_io import entry_id, file_lock, update_models_catalog, write_json_atomic

CATALOG = {
    "schemaVersion": 1,
    "models": [
        {"id": "B", "title": "Model B", "preferred": True, "view": {"center": [0, 60], "zoom": 5}},
        "A",
    ],
}


class Catalog(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / "models.json"

    def tearDown(self):
        self.dir.cleanup()

    def read(self):
        return json.loads(self.path.read_text(encoding="utf-8"))


class WriteJsonAtomic(Catalog):
    def test_writes_the_payload_and_leaves_no_temporary_file(self):
        write_json_atomic(self.path, CATALOG)
        self.assertEqual(self.read(), CATALOG)
        self.assertEqual([p.name for p in Path(self.dir.name).iterdir()], ["models.json"])

    def test_replaces_an_existing_file(self):
        self.path.write_text("old", encoding="utf-8")
        write_json_atomic(self.path, {"new": True})
        self.assertEqual(self.read(), {"new": True})


class UpdateModelsCatalog(Catalog):
    def test_keeps_every_field_and_the_order(self):
        write_json_atomic(self.path, CATALOG)
        self.assertTrue(update_models_catalog(self.path, lambda models: models + [{"id": "C"}]))
        catalog = self.read()
        self.assertEqual([entry_id(m) for m in catalog["models"]], ["B", "A", "C"])
        self.assertEqual(catalog["models"][0], CATALOG["models"][0])
        self.assertEqual(catalog["schemaVersion"], 1)

    def test_starts_a_missing_catalog_from_empty(self):
        self.assertTrue(update_models_catalog(self.path, lambda models: models + [{"id": "A"}]))
        self.assertEqual(self.read(), {"schemaVersion": 1, "models": [{"id": "A"}]})

    def test_never_replaces_a_catalog_it_cannot_read(self):
        # A half-written file, as a reader could once catch one.
        self.path.write_text('{"schemaVersion": 1, "models": [{"id": "B"', encoding="utf-8")
        with redirect_stderr(io.StringIO()):
            self.assertFalse(update_models_catalog(self.path, lambda models: [{"id": "ONLY"}]))
        self.assertEqual(self.path.read_text(encoding="utf-8"), '{"schemaVersion": 1, "models": [{"id": "B"')

    def test_never_replaces_a_file_that_is_not_a_catalog(self):
        self.path.write_text('{"models": "nope"}', encoding="utf-8")
        with redirect_stderr(io.StringIO()):
            self.assertFalse(update_models_catalog(self.path, lambda models: []))
        self.assertEqual(self.read(), {"models": "nope"})

    def test_waits_for_the_lock_and_gives_up_without_writing(self):
        write_json_atomic(self.path, CATALOG)
        with file_lock(self.path):
            with redirect_stderr(io.StringIO()) as err:
                updated = update_models_catalog(self.path, lambda models: [], timeout_s=0.3)
        self.assertFalse(updated)
        self.assertIn(".models.json.lock", err.getvalue())
        self.assertEqual(self.read(), CATALOG)

    def test_releases_the_lock(self):
        write_json_atomic(self.path, CATALOG)
        update_models_catalog(self.path, lambda models: models)
        self.assertFalse((Path(self.dir.name) / ".models.json.lock").exists())
        self.assertTrue(update_models_catalog(self.path, lambda models: models, timeout_s=0.3))


class EntryId(unittest.TestCase):
    def test_reads_objects_and_bare_ids(self):
        self.assertEqual(entry_id({"id": "A"}), "A")
        self.assertEqual(entry_id("B"), "B")
        self.assertEqual(entry_id({}), "")


if __name__ == "__main__":
    unittest.main()
