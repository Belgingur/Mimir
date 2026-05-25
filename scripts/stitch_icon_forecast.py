#!/usr/bin/env python3
"""Stitch a short ICON forecast run with the tail from the previous long ICON run.

ICON update schedule
--------------------
ICON is updated every 3 hours, but alternates between two run types:

  Long runs  (00Z, 06Z, 12Z, 18Z): 120-hour forecast
    • Hours  0–78  → hourly output   → 79 files  (indices 000–078)
    • Hours 81–120 → 3-hourly output → 14 files  (indices 079–092)
    • Total: 93 files per variable

  Short runs (03Z, 09Z, 15Z, 21Z): 30-hour forecast
    • Hours  0–30  → hourly output   → 31 files  (indices 000–030)
    • Total: 31 files per variable

Stitching strategy
------------------
The short run's last valid time is T_short + 30 h.  Expressed in the
reference frame of the previous long run (analysis time T_long):
    last short time = T_long + age_steps + 30 h
                    = T_long + (age_steps + 30) h

The first tail frame we borrow from the long run is therefore index
    tail_start_old_index = age_steps + EXPECTED_SHORT_COUNT
                         = age_steps + 31

Because short runs are always 3 h after a long run, the normal age is 3 h.
Fallback values (9, 15, 21 h) are accepted when one or two earlier long
runs are absent from the output directory.

File naming follows the same zero-padded index convention as all other
models: e.g. air_temperature_at_2m_agl_034.webp.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# ── constants ────────────────────────────────────────────────────────────────

EXPECTED_SHORT_COUNT = 31   # 0-h through 30-h hourly → 31 files
EXPECTED_LONG_COUNT  = 93   # 79 hourly + 14 three-hourly → 93 files

# Short runs are always 3 h after a long run (03Z↔00Z, 09Z↔06Z, …).
# Accept fallback long runs up to three update cycles (3 × 6 h) in the past.
VALID_AGE_STEPS = {3, 9, 15, 21}

COMPATIBILITY_KEYS = (
    "projection",
    "bounds",
    "shape",
    "srcMin",
    "srcMax",
    "imageUnscale",
    "format",
)


# ── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Stitch a short ICON forecast run (31 steps, 30 h) with the "
            "tail from the previous long ICON run (93 steps, 120 h)."
        )
    )
    parser.add_argument("--root",     required=True, help="Root output directory, e.g. forecast-data")
    parser.add_argument("--model",    default="ICON-EU", help="Model name (default: ICON-EU)")
    parser.add_argument("--analysis", required=True, help="Analysis directory name, e.g. 2026-03-11_03")
    parser.add_argument(
        "--link-mode",
        choices=("hardlink", "symlink", "copy"),
        default="hardlink",
        help="How to publish appended files (default: hardlink)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print what would happen without changing files")
    parser.add_argument("--verbose",  action="store_true", help="Enable verbose logging")
    return parser.parse_args()


# ── logging ──────────────────────────────────────────────────────────────────

def log(message: str, *, verbose: bool = True) -> None:
    if verbose:
        print(message)


def warn(message: str) -> None:
    print(f"WARNING: {message}", file=sys.stderr)


def fail(message: str) -> None:
    raise RuntimeError(message)


# ── manifest helpers ─────────────────────────────────────────────────────────

def frame_extension(manifest: dict[str, Any]) -> str:
    fmt = manifest.get("format")
    if isinstance(fmt, str) and fmt:
        return fmt.lower()
    file_template = manifest.get("fileTemplate")
    if isinstance(file_template, str) and "." in file_template:
        return file_template.rsplit(".", 1)[-1].lower()
    return "webp"


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        fail(f"Manifest not found: {path}")
    except json.JSONDecodeError as exc:
        fail(f"Invalid JSON in manifest {path}: {exc}")
    if not isinstance(data, dict):
        fail(f"Manifest {path} must contain a JSON object")
    return data  # type: ignore[return-value]


def parse_manifest_time(manifest: dict[str, Any]) -> datetime:
    analysis_iso = manifest.get("analysisTimeISO")
    if analysis_iso:
        try:
            dt = datetime.fromisoformat(str(analysis_iso).replace("Z", "+00:00"))
        except ValueError:
            fail(f"Unparsable analysisTimeISO: {analysis_iso}")
        return dt.astimezone(timezone.utc)

    analysis = manifest.get("analysisTime")
    if analysis:
        try:
            return datetime.strptime(str(analysis), "%Y-%m-%d_%H").replace(tzinfo=timezone.utc)
        except ValueError:
            fail(f"Unparsable analysisTime: {analysis}")

    fail("Manifest missing both analysisTimeISO and analysisTime")
    raise AssertionError("unreachable")


def find_variable_dirs(run_dir: Path) -> list[Path]:
    if not run_dir.is_dir():
        fail(f"Run directory does not exist: {run_dir}")
    return sorted(
        path for path in run_dir.iterdir()
        if path.is_dir() and (path / "manifest.json").is_file()
    )


def infer_run_count(run_dir: Path) -> tuple[int, list[Path]]:
    variable_dirs = find_variable_dirs(run_dir)
    if not variable_dirs:
        fail(f"No variable directories with manifest.json found under {run_dir}")
    counts: list[int] = []
    for variable_dir in variable_dirs:
        manifest = load_manifest(variable_dir / "manifest.json")
        count = manifest.get("count")
        if isinstance(count, int):
            counts.append(count)
        else:
            warn(f"Skipping non-integer count in {variable_dir / 'manifest.json'}")
    if not counts:
        fail(f"No valid manifest counts found under {run_dir}")
    most_common_count, _ = Counter(counts).most_common(1)[0]
    if len(set(counts)) > 1:
        warn(f"Manifest count disagreement in {run_dir}; using most common count {most_common_count}")
    return most_common_count, variable_dirs


def get_run_analysis_time(run_dir: Path) -> datetime:
    variable_dirs = find_variable_dirs(run_dir)
    if not variable_dirs:
        fail(f"No manifest.json files found under {run_dir}")
    timestamps: list[datetime] = []
    for variable_dir in variable_dirs:
        manifest = load_manifest(variable_dir / "manifest.json")
        timestamps.append(parse_manifest_time(manifest))
    most_common_dt, _ = Counter(timestamps).most_common(1)[0]
    if len(set(timestamps)) > 1:
        warn(
            f"Analysis-time disagreement in {run_dir}; using most common timestamp "
            f"{most_common_dt.isoformat()}"
        )
    return most_common_dt


def compare_manifests_compatible(
    current_manifest: dict[str, Any], old_manifest: dict[str, Any]
) -> tuple[bool, str]:
    for key in COMPATIBILITY_KEYS:
        if current_manifest.get(key) != old_manifest.get(key):
            return False, f"{key} differs"
    return True, ""


def frame_path_from_manifest(variable_dir: Path, manifest: dict[str, Any], index: int) -> Path:
    file_template = manifest.get("fileTemplate")
    if not isinstance(file_template, str) or "{index:03d}" not in file_template:
        fail(f"Unsupported or missing fileTemplate in {variable_dir / 'manifest.json'}")
    return variable_dir / file_template.format(index=index)


# ── file operations ──────────────────────────────────────────────────────────

def clear_appended_outputs(
    current_variable_dir: Path,
    current_manifest: dict[str, Any],
    start_index: int,
    dry_run: bool,
    verbose: bool,
) -> None:
    """Remove any appended frame files at or beyond *start_index* (idempotent re-run support)."""
    file_template = current_manifest.get("fileTemplate")
    if not isinstance(file_template, str) or "{index:03d}" not in file_template:
        fail(f"Unsupported or missing fileTemplate in {current_variable_dir / 'manifest.json'}")
    ext = frame_extension(current_manifest)
    for path in sorted(current_variable_dir.glob(f"*.{ext}")):
        name = path.name
        try:
            idx_text = name.rsplit("_", 1)[1].split(".", 1)[0]
            idx = int(idx_text)
        except Exception:
            continue
        if idx < start_index:
            continue
        log(f"remove {path}", verbose=verbose)
        if not dry_run and path.exists():
            path.unlink()


def publish_file(src: Path, dst: Path, mode: str, dry_run: bool, verbose: bool) -> None:
    log(f"publish {src} -> {dst} [{mode}]", verbose=verbose)
    if dry_run:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() or dst.is_symlink():
        dst.unlink()
    if mode == "hardlink":
        try:
            os.link(src, dst)
        except OSError as exc:
            fail(
                f"Hardlink failed for {src} -> {dst}: {exc}. "
                "Use --link-mode symlink or --link-mode copy if the paths span filesystems."
            )
    elif mode == "symlink":
        relative_src = os.path.relpath(src, start=dst.parent)
        os.symlink(relative_src, dst)
    elif mode == "copy":
        shutil.copy2(src, dst)
    else:
        fail(f"Unsupported link mode: {mode}")


def write_manifest(path: Path, manifest: dict[str, Any], dry_run: bool, verbose: bool) -> None:
    log(f"write manifest {path}", verbose=verbose)
    if dry_run:
        return
    with path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, sort_keys=False)
        f.write("\n")


# ── per-variable stitching ───────────────────────────────────────────────────

def stitch_variable_dir(
    current_variable_dir: Path,
    previous_variable_dir: Path,
    age_steps: int,
    link_mode: str,
    dry_run: bool,
    verbose: bool,
    current_analysis_manifest: dict[str, Any],
    previous_analysis_manifest: dict[str, Any],
) -> None:
    current_manifest_path  = current_variable_dir  / "manifest.json"
    previous_manifest_path = previous_variable_dir / "manifest.json"
    current_manifest  = load_manifest(current_manifest_path)
    previous_manifest = load_manifest(previous_manifest_path)

    compatible, reason = compare_manifests_compatible(current_manifest, previous_manifest)
    if not compatible:
        warn(
            f"Skipping stitch for {current_variable_dir.name}: incompatible manifests "
            f"({reason}) between {current_manifest_path} and {previous_manifest_path}"
        )
        return

    current_times = current_manifest.get("times")
    old_times     = previous_manifest.get("times")
    if not isinstance(current_times, list) or not isinstance(old_times, list):
        fail(f"Missing or invalid times array in {current_manifest_path} or {previous_manifest_path}")

    if len(current_times) < EXPECTED_SHORT_COUNT:
        fail(f"Current run {current_variable_dir} has fewer than {EXPECTED_SHORT_COUNT} times")
    if len(old_times) < EXPECTED_LONG_COUNT:
        fail(f"Previous long run {previous_variable_dir} has fewer than {EXPECTED_LONG_COUNT} times")

    # The short run's last valid time is at T_long + (age_steps + 30) h.
    # In the long run's index space that corresponds to index (age_steps + 30),
    # so the first tail frame is at index (age_steps + 31) = age_steps + EXPECTED_SHORT_COUNT.
    tail_start_old_index = age_steps + EXPECTED_SHORT_COUNT

    if tail_start_old_index >= EXPECTED_LONG_COUNT:
        fail(
            f"tail_start_old_index={tail_start_old_index} is outside the long run "
            f"({EXPECTED_LONG_COUNT} frames) — age_steps={age_steps} is too large to stitch"
        )

    new_times  = list(current_times[:EXPECTED_SHORT_COUNT]) + list(old_times[tail_start_old_index:])
    final_count = len(new_times)

    clear_appended_outputs(
        current_variable_dir=current_variable_dir,
        current_manifest=current_manifest,
        start_index=EXPECTED_SHORT_COUNT,
        dry_run=dry_run,
        verbose=verbose,
    )

    for published_index, old_index in enumerate(
        range(tail_start_old_index, EXPECTED_LONG_COUNT),
        start=EXPECTED_SHORT_COUNT,
    ):
        src = frame_path_from_manifest(previous_variable_dir, previous_manifest, old_index)
        dst = frame_path_from_manifest(current_variable_dir,  current_manifest,  published_index)
        if not src.is_file():
            fail(f"Missing old tail frame: {src}")
        publish_file(src, dst, link_mode, dry_run, verbose)

    stitched_manifest = dict(current_manifest)
    stitched_manifest["count"] = final_count
    stitched_manifest["times"] = new_times
    stitched_manifest["stitchedForecast"] = {
        "mode":                  "icon_tail_merge",
        "currentAnalysis":       current_analysis_manifest.get("analysisTime"),
        "currentAnalysisISO":    current_analysis_manifest.get("analysisTimeISO"),
        "tailSourceAnalysis":    previous_analysis_manifest.get("analysisTime"),
        "tailSourceAnalysisISO": previous_analysis_manifest.get("analysisTimeISO"),
        "ageSteps":              age_steps,
        "tailStartOldIndex":     tail_start_old_index,
    }
    write_manifest(current_manifest_path, stitched_manifest, dry_run, verbose)


# ── run discovery ─────────────────────────────────────────────────────────────

def find_previous_long_run(root: Path, model: str, current_analysis_time: datetime, verbose: bool) -> Path:
    """Return the most recent long run (93 steps) that predates *current_analysis_time*."""
    model_dir = root / model
    if not model_dir.is_dir():
        fail(f"Model directory does not exist: {model_dir}")

    candidates: list[tuple[datetime, Path]] = []
    for run_dir in sorted(path for path in model_dir.iterdir() if path.is_dir()):
        try:
            run_time = get_run_analysis_time(run_dir)
        except RuntimeError as exc:
            warn(f"Skipping run {run_dir}: {exc}")
            continue
        if run_time >= current_analysis_time:
            continue
        try:
            run_count, _ = infer_run_count(run_dir)
        except RuntimeError as exc:
            warn(f"Skipping run {run_dir}: {exc}")
            continue
        if run_count == EXPECTED_LONG_COUNT:
            candidates.append((run_time, run_dir))

    if not candidates:
        fail(
            f"No previous long ICON run ({EXPECTED_LONG_COUNT} steps) found under {model_dir} "
            f"before {current_analysis_time.isoformat()}"
        )

    candidates.sort(key=lambda item: item[0])
    previous_time, previous_dir = candidates[-1]
    log(f"Using previous long run {previous_dir.name} at {previous_time.isoformat()}", verbose=verbose)
    return previous_dir


# ── top-level orchestration ───────────────────────────────────────────────────

def stitch_run(
    root: Path,
    model: str,
    analysis: str,
    link_mode: str,
    dry_run: bool,
    verbose: bool,
) -> int:
    run_dir = root / model / analysis
    if not run_dir.is_dir():
        fail(f"Current run directory missing: {run_dir}")

    current_count, current_variable_dirs = infer_run_count(run_dir)
    current_analysis_time     = get_run_analysis_time(run_dir)
    current_reference_manifest = load_manifest(current_variable_dirs[0] / "manifest.json")

    if current_count == EXPECTED_LONG_COUNT:
        print(f"Current ICON run is already long ({EXPECTED_LONG_COUNT} steps); no stitching needed.")
        return 0
    if current_count != EXPECTED_SHORT_COUNT:
        fail(
            f"Current run count for {run_dir} is {current_count}; "
            f"expected {EXPECTED_SHORT_COUNT} (short) or {EXPECTED_LONG_COUNT} (long)"
        )

    previous_long_run_dir = find_previous_long_run(root, model, current_analysis_time, verbose)
    previous_count, previous_variable_dirs = infer_run_count(previous_long_run_dir)
    if previous_count != EXPECTED_LONG_COUNT:
        fail(f"Previous long run {previous_long_run_dir} did not resolve to {EXPECTED_LONG_COUNT} steps")
    previous_reference_manifest = load_manifest(previous_variable_dirs[0] / "manifest.json")
    previous_analysis_time      = parse_manifest_time(previous_reference_manifest)

    delta_seconds = (current_analysis_time - previous_analysis_time).total_seconds()
    if delta_seconds <= 0:
        fail("Previous long run analysis time is not earlier than the current run analysis time")
    if delta_seconds % 3600 != 0:
        fail(
            f"Analysis time delta between {previous_long_run_dir.name} and {analysis} "
            "is not an integer number of hours"
        )
    age_steps = int(delta_seconds // 3600)
    if age_steps not in VALID_AGE_STEPS:
        fail(
            f"Unexpected age_steps={age_steps} h; expected one of {sorted(VALID_AGE_STEPS)} "
            "(short ICON runs are always 3 h after a long run; "
            "larger values indicate missed long runs)"
        )

    final_expected_count = EXPECTED_LONG_COUNT - age_steps
    print(
        f"Stitching short ICON run {analysis} ({EXPECTED_SHORT_COUNT} steps) "
        f"with tail from {previous_long_run_dir.name} ({EXPECTED_LONG_COUNT} steps); "
        f"age_steps={age_steps} h, final count={final_expected_count}"
    )

    previous_variable_map = {path.name: path for path in previous_variable_dirs}
    stitched = 0
    skipped  = 0
    for current_variable_dir in current_variable_dirs:
        previous_variable_dir = previous_variable_map.get(current_variable_dir.name)
        if previous_variable_dir is None:
            warn(f"Skipping {current_variable_dir.name}: variable missing in previous long run")
            skipped += 1
            continue
        stitch_variable_dir(
            current_variable_dir=current_variable_dir,
            previous_variable_dir=previous_variable_dir,
            age_steps=age_steps,
            link_mode=link_mode,
            dry_run=dry_run,
            verbose=verbose,
            current_analysis_manifest=current_reference_manifest,
            previous_analysis_manifest=previous_reference_manifest,
        )
        stitched += 1

    print(f"Completed ICON stitching for {analysis}: stitched={stitched}, skipped={skipped}")
    return 0


# ── entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()
    try:
        return stitch_run(
            root=Path(args.root),
            model=args.model,
            analysis=args.analysis,
            link_mode=args.link_mode,
            dry_run=args.dry_run,
            verbose=args.verbose,
        )
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
