#!/usr/bin/env python3
"""Generate src/lib/temperatureScale.ts from scales/gfs_temp_scale.json.

The JSON is the source of truth for the 2m-temperature ramp; this script is the
only thing that turns it into application code, so the raster palette and the
legend (which both read the generated array) cannot drift from it.

Run from the repo root after editing the JSON:

    python3 scripts/gen_temperature_scale.py

The ramp is truncated to the encoder's domain. netcdf2image.py quantises
temperature to uint8 over srcMin/srcMax from manifest_scaling_v2.yml with
`clip: BOTH`, so bands outside that window can never be reached by any pixel and
emitting them would only mislead whoever reads the legend.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "scales" / "gfs_temp_scale.json"
TARGET = REPO_ROOT / "src" / "lib" / "temperatureScale.ts"

# Must match air_temperature_at_2m_agl in scripts/manifest_scaling_v2.yml.
DOMAIN_MIN = -50.0
DOMAIN_MAX = 50.0


def build_stops(scale: dict) -> list[tuple[int, str]]:
    """Return [lower_edge, hex] stops covering the encoder domain."""
    bands = sorted(scale["bands"], key=lambda b: b["lower"])
    stops = [
        (int(b["lower"]), b["hex"].lower())
        for b in bands
        if DOMAIN_MIN <= b["lower"] < DOMAIN_MAX
    ]
    if not stops:
        raise SystemExit(
            f"no bands fall inside [{DOMAIN_MIN}, {DOMAIN_MAX}) — "
            "check the domain constants against manifest_scaling_v2.yml"
        )

    expected = int(DOMAIN_MAX - DOMAIN_MIN)
    if len(stops) != expected:
        raise SystemExit(
            f"expected {expected} 1°C bands in domain, got {len(stops)} — "
            "the JSON band table is not contiguous over the encoder range"
        )

    # Terminal anchor: repeats the top band's colour so the legend has a stop to
    # measure its full height against. It is deliberately NOT the `above_max`
    # overflow colour — see the header comment in the generated file.
    stops.append((int(DOMAIN_MAX), stops[-1][1]))
    return stops


def render(scale: dict, stops: list[tuple[int, str]]) -> str:
    quant = (DOMAIN_MAX - DOMAIN_MIN) / 255
    lines = [
        "// GENERATED FILE — do not edit by hand.",
        "// Regenerate with: python3 scripts/gen_temperature_scale.py",
        "//",
        f"// Source: scales/gfs_temp_scale.json ({scale['name']}).",
        "// Each entry is the lower edge of a 1°C band; buildStepPalette turns the",
        "// list into hard-edged steps, so the colour holds until the next stop.",
        "//",
        f"// Truncated to the encoder domain [{DOMAIN_MIN:g}, {DOMAIN_MAX:g}]°C. The source ramp",
        "// runs to -60°C, but netcdf2image.py quantises temperature to uint8 over",
        "// srcMin/srcMax from manifest_scaling_v2.yml with `clip: BOTH`, so colder",
        "// values are already saturated at the bottom code and the -60..-50 bands are",
        "// unreachable. Widening this ramp requires re-encoding every frame.",
        "//",
        "// The JSON's below_min/above_max overflow colours are intentionally unused:",
        "// with `clip: BOTH`, an out-of-range pixel is indistinguishable from a genuine",
        f"// {DOMAIN_MIN:g}°C or {DOMAIN_MAX:g}°C reading, so painting the endpoints as overflow would",
        "// misreport real data.",
        "//",
        f"// Resolution floor: {quant:.3f}°C per uint8 code, so 1°C bands span 2-3 codes",
        "// and band edges carry up to +/-{:.2f}°C of quantisation jitter. The 0°C".format(quant / 2),
        "// discontinuity lands on the 127/128 code boundary (-0.196 / +0.196°C).",
        "export const TEMPERATURE_SCALE: [number, string][] = [",
    ]
    for value, hex_colour in stops[:-1]:
        label = f"{value:>3}°C"
        lines.append(f'  [{value}, "{hex_colour}"], // {label}')
    terminal_value, terminal_hex = stops[-1]
    lines.append(
        f'  [{terminal_value}, "{terminal_hex}"], '
        f"// terminal — anchors the scale at {terminal_value}°C for legend tick spacing"
    )
    lines.append("];")
    lines.append("")
    lines.append("export default TEMPERATURE_SCALE;")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    scale = json.loads(SOURCE.read_text())
    stops = build_stops(scale)
    TARGET.write_text(render(scale, stops))
    print(f"wrote {TARGET.relative_to(REPO_ROOT)} — {len(stops)} stops")


if __name__ == "__main__":
    main()
