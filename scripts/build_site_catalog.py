#!/usr/bin/env python3
"""
Build the models.json a site publishes, from the full catalog and a site file.

netcdf2image.py keeps one models.json listing every model it converts. When the
same frames are published to several sites, each may show only some of the
models, in its own order, opening on its own default. A site file says which:

    # The models this site shows, in the order its chooser lists them
    models:
      - id: ICON-EU
        default: true
      - id: GFS
        title: GFS (global)
      - GWES

Each listed model gets its catalog entry (coverage, view, preferred, ...), with
any field the site file gives replacing the catalog's. Models the site does not
list are left out. The default is decided by the site alone: the model it marks
`default: true`, or its first model when it marks none. A listed model missing
from the catalog (not converted yet) is reported and left out. Every top-level
field but `models` is kept.

Usage:
    python scripts/build_site_catalog.py CATALOG SITE [--out models.json]

CATALOG is the full models.json and SITE the site file (YAML). Without --out the
result goes to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml

from catalog_io import entry_id, write_json_atomic


def site_entries(site: Any) -> list[dict[str, Any]]:
    """The `models` list of a site file, each entry an object with an id."""
    if not isinstance(site, dict) or not isinstance(site.get("models"), list):
        raise ValueError("site file has no `models` list")
    entries = []
    for item in site["models"]:
        entry = dict(item) if isinstance(item, dict) else {"id": item}
        if not isinstance(entry.get("id"), str) or not entry["id"]:
            raise ValueError(f"site entry without an id: {item!r}")
        entries.append(entry)
    ids = [entry["id"] for entry in entries]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"site lists {', '.join(duplicates)} more than once")
    defaults = [entry["id"] for entry in entries if entry.get("default")]
    if len(defaults) > 1:
        raise ValueError(f"site marks more than one default: {', '.join(defaults)}")
    return entries


def build_site_catalog(catalog: Any, site: Any) -> tuple[dict[str, Any], list[str]]:
    """
    The site's models.json, and the ids it lists that the catalog lacks.
    Raises ValueError when either file is malformed or no listed model is in
    the catalog: publishing an empty chooser would break the site.
    """
    if not isinstance(catalog, dict) or not isinstance(catalog.get("models"), list):
        raise ValueError("catalog has no `models` list")
    wanted = site_entries(site)
    by_id = {entry_id(m): m for m in catalog["models"]}

    models = []
    missing = []
    for entry in wanted:
        found = by_id.get(entry["id"])
        if found is None:
            missing.append(entry["id"])
            continue
        base = found if isinstance(found, dict) else {"id": found, "title": found}
        models.append({**base, **entry})
    if not models:
        raise ValueError("none of the site's models is in the catalog")

    listed = [m["id"] for m in models]
    marked = [e["id"] for e in wanted if e.get("default") and e["id"] in listed]
    site_default = marked[0] if marked else listed[0]
    models = [{**m, "default": m["id"] == site_default} for m in models]
    return {**catalog, "models": models}, missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("catalog", help="the full models.json")
    parser.add_argument("site", help="site file (YAML) listing the models the site shows")
    parser.add_argument("--out", help="write the site's models.json here instead of stdout")
    args = parser.parse_args()

    try:
        catalog = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
        site = yaml.safe_load(Path(args.site).read_text(encoding="utf-8"))
        result, missing = build_site_catalog(catalog, site)
    except (OSError, ValueError, yaml.YAMLError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    for model in missing:
        print(f"WARNING: {model} is not in {args.catalog}; left out", file=sys.stderr)

    if not args.out:
        sys.stdout.write(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
        return 0
    write_json_atomic(Path(args.out), result)
    print(f"wrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
