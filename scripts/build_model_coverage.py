#!/usr/bin/env python3
"""
Fill in the coverage fields of an existing catalog's models.json.

netcdf2image.py writes bbox, resolution_km and domain_mask for each model it
converts. For a catalog built before that, or by another pipeline, this reads
every model's latest run and writes models.json with those fields filled in.
Every other field (title, default, preferred, view, ...) and the order of the
models are kept. See catalog_coverage.py for what the fields mean.

Usage:
    python scripts/build_model_coverage.py SOURCE [--out models.json]
        [--cells 160] [--user U --password P]

SOURCE is either a local forecast-data directory or the origin that serves one
(https://example.org, with /forecast-data appended). Without --out the result
goes to stdout. A model that cannot be read is reported and left as it was.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import urllib.request
from pathlib import Path
from typing import Any

from catalog_coverage import (
    DEFAULT_MASK_CELLS,
    Fetch,
    merge_coverage,
    model_coverage,
)

FORECAST_DATA_SUBDIR = "forecast-data"


def make_fetch(source: str, user: str | None, password: str | None) -> Fetch:
    if source.startswith(("http://", "https://")):
        base = f"{source.rstrip('/')}/{FORECAST_DATA_SUBDIR}"
        headers = {}
        if user and password:
            token = base64.b64encode(f"{user}:{password}".encode()).decode()
            headers["Authorization"] = f"Basic {token}"

        def fetch_url(path: str) -> bytes:
            request = urllib.request.Request(f"{base}/{path}", headers=headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()

        return fetch_url

    root = Path(source)

    def fetch_file(path: str) -> bytes:
        return (root / path).read_bytes()

    return fetch_file


def ids(data: Any, key: str) -> list[str]:
    items = data if isinstance(data, list) else data.get(key, [])
    return [str(x["id"]) if isinstance(x, dict) else str(x) for x in items]


def latest_analysis(fetch: Fetch, model: str) -> str:
    data = json.loads(fetch(f"{model}/analyses.json"))
    latest = data.get("latest") if isinstance(data, dict) else None
    analyses = ids(data, "analyses")
    if not latest and not analyses:
        raise ValueError("no analyses")
    return latest or sorted(analyses)[-1]


def manifest_paths(fetch: Fetch, model: str, analysis: str) -> list[str]:
    data = json.loads(fetch(f"{model}/{analysis}/variables.json"))
    entries = data if isinstance(data, list) else data.get("variables", [])
    paths = []
    for entry in entries:
        if isinstance(entry, dict):
            paths.append(entry.get("manifest") or f"{entry['id']}/manifest.json")
        else:
            paths.append(f"{entry}/manifest.json")
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("source", help="forecast-data directory, or the origin serving it")
    parser.add_argument("--out", help="write models.json here instead of stdout")
    parser.add_argument("--cells", type=int, default=DEFAULT_MASK_CELLS,
                        help="mask cells along a grid's longer side")
    parser.add_argument("--user")
    parser.add_argument("--password")
    args = parser.parse_args()

    fetch = make_fetch(args.source, args.user, args.password)
    catalog = json.loads(fetch("models.json"))
    if not isinstance(catalog, dict) or not isinstance(catalog.get("models"), list):
        print("models.json has no `models` array", file=sys.stderr)
        return 1

    models = []
    for entry in catalog["models"]:
        if not isinstance(entry, dict):
            entry = {"id": str(entry), "title": str(entry)}
        model = str(entry.get("id", ""))
        try:
            analysis = latest_analysis(fetch, model)
            coverage = model_coverage(
                fetch, model, analysis, manifest_paths(fetch, model, analysis), cells=args.cells
            )
            entry = merge_coverage(entry, coverage)
            mask = coverage.get("domain_mask")
            print(
                f"✓ {model} {analysis}: {coverage.get('resolution_km')} km"
                + (f", {mask['cols']}x{mask['rows']} mask" if mask else ", data fills its bbox"),
                file=sys.stderr,
            )
        except Exception as error:  # noqa: BLE001 — report it and keep the entry as it was
            print(f"✗ {model}: {error}", file=sys.stderr)
        models.append(entry)

    output = json.dumps({**catalog, "models": models}, indent=2, ensure_ascii=False) + "\n"
    if args.out:
        Path(args.out).write_text(output, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
