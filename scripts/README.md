# Data Conversion Scripts

This directory contains Python helpers for converting NetCDF forecast model output into the WebP tile format expected by the Mímir viewer, and for extending short model runs with tails from earlier long runs.

| File | Purpose |
| ---- | ------- |
| `netcdf2image.py` | Convert NetCDF variables to WebP/PNG frames and write catalog JSON |
| `stitch_rap_forecast.py` | Extend a short RAP run with frames from the previous long RAP run |
| `stitch_icon_forecast.py` | Extend a short ICON-EU run with frames from the previous long ICON run |
| `config_GFS.yml` | Example config for GFS atmospheric output |
| `config_GWES.yml` | Example config for GWES wave output |
| `manifest_scaling_v2.yml` | Curated fixed-scale policy for common meteorological variables |

## Requirements

Python 3.10+ with:

```bash
pip install -r requirements.txt
```

For regridding curvilinear or projected grids (e.g. WRF output):

```bash
# Requires ESMF; easiest via conda
conda install -c conda-forge xesmf
```

## Quick Start

Run these commands from the `scripts/` directory (or pass full paths to the scripts).

```bash
# See what variables are in a NetCDF file
python netcdf2image.py -i forecast.nc --model GFS --out-root ./output --list-vars

# Export one variable with auto-scaling
python netcdf2image.py -i forecast.nc --model GFS --out-root ./output \
    --variable air_temperature_at_2m_agl

# Export several variables using a config file
python netcdf2image.py --config config_GFS.yml -i forecast.nc

# Export all numeric variables, 4 parallel workers
python netcdf2image.py -i forecast.nc --model GFS --out-root ./output \
    --export-all --jobs 4
```

## Output Structure

`netcdf2image.py` writes catalog files and image frames under `<out-root>/forecast-data/`:

```text
<out-root>/forecast-data/
  models.json
  <model>/
    analyses.json
    <analysis>/              # e.g. 2026-05-25_00
      variables.json
      <variable>/
        manifest.json
        <variable>_000.webp
        <variable>_001.webp
        ...
```

To use with Mímir locally, copy the contents of `<out-root>/forecast-data/` into `public/forecast-data/` in your Mímir checkout. Alternatively, serve that directory from a CDN or API and set `VITE_INHOUSE_ROOT` to that origin (without appending `/forecast-data`).

## Config Files

YAML config files let you set default parameters without long command lines. Any option can be overridden from the CLI — CLI flags always take precedence over the config file.

```bash
python netcdf2image.py --config config_GFS.yml -i /path/to/gfs_output.nc
```

See `config_GFS.yml` and `config_GWES.yml` for annotated examples.

Supported config keys (use underscores; these map directly to the CLI flags):

| Config key            | CLI flag                  | Description                                           |
| --------------------- | ------------------------- | ----------------------------------------------------- |
| `input`               | `-i` / `--input`          | Path to input NetCDF file                             |
| `model`               | `--model`                 | Model identifier, e.g. `GFS` or `GWES`                |
| `out_root`            | `--out-root`              | Output root directory                                 |
| `jobs`                | `--jobs`                  | Parallel worker processes (default: 1)                |
| `include`             | `--include`               | Variable allowlist (YAML list)                        |
| `exclude`             | `--exclude`               | Variable denylist (YAML list)                         |
| `format`              | `--format`                | `WEBP` (default) or `PNG`                             |
| `scale_mode`          | `--scale-mode`            | `auto` (default) or `fixed`                           |
| `scale_config`        | `--scale-config`          | Path to fixed-scale JSON (required for fixed mode)    |
| `scaling_policy_yml`  | `--scaling-policy-yml`    | Path to `manifest_scaling_v2.yml` (or similar policy) |
| `emit_scale_config`   | `--emit-scale-config`     | Write computed auto scales to a JSON file             |
| `regrid_method`       | `--regrid-method`         | `bilinear` (default) or `nearest`                     |
| `weights_dir`         | `--weights-dir`           | Cache directory for xESMF regrid weights              |
| `verbose`             | `--verbose`               | Verbose per-frame logging                             |
| `analysis`            | `--analysis`              | Override analysis time `YYYY-MM-DD_hh`                |
| `history_interval`    | `--history_interval`      | Override timestep spacing in minutes                  |
| `pmin` / `pmax`       | `--pmin` / `--pmax`       | Percentile range for auto scaling (default: 0/100)    |
| `target_bounds`       | `--target-bounds`         | Regrid target bounds `[minLon,minLat,maxLon,maxLat]`  |
| `target_res_deg`      | `--target-res-deg`        | Regrid target resolution in degrees                   |
| `target_shape`        | `--target-shape`          | Regrid target shape `width,height`                    |

## Scaling

### Auto scaling (default)

The script samples all timesteps and derives min/max from configurable percentiles (`--pmin` / `--pmax`, defaulting to the full data range). For robust ranges that ignore outliers, try `--pmin 1 --pmax 99`.

### Fixed scaling

Use `--scale-mode fixed` with a JSON file that maps variable names to `[min, max]` pairs:

```json
{
  "air_temperature_at_2m_agl": [-50.0, 50.0],
  "wind_speed_at_10m_agl": [0.0, 100.0],
  "lwe_precipitation_rate": [0.0, 250.0]
}
```

`manifest_scaling_v2.yml` defines curated product ranges for common meteorological variables. Pass it with `--scaling-policy-yml manifest_scaling_v2.yml` to apply those ranges during export, or use it as a reference when building your own JSON scale config.

To capture auto-computed scales for reuse across model runs:

```bash
python netcdf2image.py ... --emit-scale-config scales.json
# Then lock them in:
python netcdf2image.py ... --scale-mode fixed --scale-config scales.json
```

When exporting GFS wind components (`U_true_at_10m_agl` / `V_true_at_10m_agl`), the script also derives a combined `wind_uv_10m` vector dataset used by Mímir for arrow, particle, and streamline layers.

## Regridding

If the input is on a curvilinear or projected grid (e.g. WRF output with `XLAT`/`XLONG` arrays), the script detects this automatically and regrids to a regular lat/lon grid using xESMF.

To specify the target grid explicitly:

```bash
# By resolution
python netcdf2image.py ... --target-bounds "[-25,63,0,67]" --target-res-deg 0.1

# By exact pixel dimensions
python netcdf2image.py ... --target-bounds "[-25,63,0,67]" --target-shape 250,40
```

Regrid weights are cached under `--weights-dir` (default: `<out-root>/.xesmf_weights`) and reused on subsequent runs.

## Multi-Level Data

For 3D data (e.g. pressure levels or WRF `bottom_top`), select a level with `--isel` before export:

```bash
python netcdf2image.py ... --variable temperature --isel bottom_top=0
```

Alternatively, use `--reduce-vertical first|max|mean` to collapse extra dimensions automatically.

## Dry Run

Print what would be exported without writing any files:

```bash
python netcdf2image.py ... --dry-run
```

## Forecast Run Stitching

Some models alternate between short and long forecast runs. After exporting a short run with `netcdf2image.py`, use a stitch script to append the remaining lead times from the most recent compatible long run.

Both stitch scripts operate on the catalog layout inside `<out-root>/forecast-data/` (or any directory with the same `<model>/<analysis>/<variable>/` structure). Pass `--root` pointing at that directory, not the parent `out-root`.

### RAP (`stitch_rap_forecast.py`)

RAP short runs contain 22 hourly frames; long runs contain 52. The stitcher copies tail frames from the previous long run and updates each variable's `manifest.json`.

```bash
python stitch_rap_forecast.py \
    --root ./output/forecast-data \
    --model RAP \
    --analysis 2026-03-11_05
```

Options: `--link-mode hardlink|symlink|copy` (default: `hardlink`), `--dry-run`, `--verbose`.

### ICON-EU (`stitch_icon_forecast.py`)

ICON short runs (03Z, 09Z, 15Z, 21Z) contain 31 hourly frames; long runs (00Z, 06Z, 12Z, 18Z) contain 93. The stitcher appends the long-run tail starting at the appropriate lead time.

```bash
python stitch_icon_forecast.py \
    --root ./output/forecast-data \
    --model ICON-EU \
    --analysis 2026-03-11_03
```

Options match the RAP stitcher. See the module docstring at the top of `stitch_icon_forecast.py` for the full ICON update schedule and index arithmetic.
