"""
Writing the catalog's JSON files safely.

The catalog is read by browsers while the pipeline writes it. Path.write_text
empties a file before filling it, so a request that lands in between gets an
empty or truncated file, and the viewer fails to load. And models.json is
updated by read-modify-write, so two conversions at once could each overwrite
the other's change, and a read that caught a half-written file used to replace
the whole catalog with the one model being converted.

So every catalog file is written to a temporary file beside it and renamed
into place (a reader sees the old file or the new one, never a part), and
models.json is updated under a lock, from a fresh read, and never replaced
when it cannot be read.
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

#: A models.json entry: an object, or a bare id.
ModelEntry = dict[str, Any] | str


def write_json_atomic(path: Path, payload: Any) -> None:
    """Write JSON so that a reader never sees a half-written file."""
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temp.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


@contextmanager
def file_lock(path: Path, *, timeout_s: float = 60.0, poll_s: float = 0.2) -> Iterator[None]:
    """
    Hold `<path>.lock` for the duration. Raises TimeoutError when another
    process holds it longer than `timeout_s`. A lock left behind by a process
    that died has to be removed by hand; the error names it.
    """
    lock = path.with_name(f".{path.name}.lock")
    deadline = time.monotonic() + timeout_s
    while True:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            if time.monotonic() > deadline:
                raise TimeoutError(
                    f"{lock} has been held for over {timeout_s:.0f} s; "
                    "delete it if no conversion is running"
                ) from None
            time.sleep(poll_s)
    try:
        os.write(fd, str(os.getpid()).encode())
        yield
    finally:
        os.close(fd)
        lock.unlink(missing_ok=True)


def update_models_catalog(
    path: Path,
    update: Callable[[list[ModelEntry]], list[ModelEntry]],
    *,
    timeout_s: float = 60.0,
) -> bool:
    """
    Apply `update` to the `models` list of models.json, under a lock and from a
    fresh read, and write the result atomically. Every other top-level field is
    kept. A missing file starts from an empty list.

    Returns False, leaving the file exactly as it was, when it exists but is not
    a readable catalog, or when the lock cannot be had: a catalog that cannot be
    read must not be replaced by a guess at it.
    """
    try:
        with file_lock(path, timeout_s=timeout_s):
            catalog: dict[str, Any] = {"schemaVersion": 1, "models": []}
            if path.exists():
                try:
                    catalog = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, ValueError) as error:
                    print(f"ERROR: {path} cannot be read ({error}); left as it is", file=sys.stderr)
                    return False
                if not isinstance(catalog, dict) or not isinstance(catalog.get("models"), list):
                    print(f"ERROR: {path} has no `models` list; left as it is", file=sys.stderr)
                    return False
            write_json_atomic(path, {**catalog, "models": update(list(catalog["models"]))})
            return True
    except TimeoutError as error:
        print(f"ERROR: {error}; {path} not updated", file=sys.stderr)
        return False


def entry_id(entry: ModelEntry) -> str:
    """The id of a models.json entry, object or bare id."""
    return str(entry.get("id", "")) if isinstance(entry, dict) else str(entry)
