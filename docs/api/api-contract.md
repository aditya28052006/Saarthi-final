# SIH Monsoon Outlook — API contract (Python package → Spring Boot → vanilla JS + Leaflet)

Source of truth: `data/processed/application/latest_forecast.json` (canonical), `blocks.json`, `sangrur_blocks.geojson`, fixtures in `api/`.

## Implemented endpoints (Spring Boot)

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{status, forecast_available, issue_date, valid_from, valid_to, generated_at, source, stale, age_days, expires_at, blocks_available, forecast_horizon_days, model}` |
| `GET /api/blocks` | static block metadata (`blocks.json`) |
| `GET /api/blocks/geojson` | `sangrur_blocks.geojson` (`application/geo+json`) |
| `GET /api/forecast/latest` | full canonical forecast (`system` + `forecast` + `summary`) |
| `GET /api/forecast/freshness` | freshness only (`available, issue_date, valid_from, valid_to, generated_at, source, stale, expired, age_days, expires_at`) |
| `POST /api/forecast/reload` | re-reads the NB06 package (no restart); returns freshness; HTTP 500 + previous forecast kept on invalid package |
| `GET /api/forecast/{blockId}` | single block outlook (`block_id` = `bhuvan_b_<b_code>` or name, case-insensitive; unknown → 404 `unknown_block`) |
| `GET /api/forecast/summary` | `summary` object (district totals, category lists) |
| `GET /api/advisories/{blockId}` | `advisories[]` of the block (prototype-labeled; unknown block → 404) |
| `GET /api/panchayats[?block=]` | panchayat reference lists; unknown `block` → 404 `unknown_block` (never a silent fallback) |
| `POST /api/farmer-analysis` | agronomy guidance from the REAL forecast; unknown/missing/blank block → 404 `unknown_block` (never another block's rainfall) |
| `GET /api/climate-context` | MJO/IOD/ENSO summary (explanatory only; unavailable → `{available:false}`, rainfall unaffected; DMI numeric) |
| `POST /api/climate-context/reload` | re-reads the climate package (no restart; fail-soft → `{available:false}`, HTTP 200) |
| `GET /api/mjo/latest` | MJO node only |

Synthetic endpoints (`/outlook`, `/predict`, `/map-data`) remain REMOVED. No synthetic forecast fallback exists: API failure surfaces an explicit error in the UI.

## Field reference (per block)

- `block_id` (string, stable Bhuvan scheme), `block_name`, `forecast_7d_total_rainfall_mm` (mm),
- `category` ∈ {LOW, NORMAL, HIGH} (thresholds LOW<10.94 / HIGH>34.66 mm, training-only),
- `probability` {low, normal, high} ∈ [0,1], sum ≈ 1 within 1e-3 (residual-ECDF, train-only; enforced by backend validation, documented — not expressible in vanilla JSON Schema),
- `daily_forecast[7]` each {date, day 1..7, rainfall_mm}; total == sum(daily) within 0.05 (presentation rounding),
- `indicators` {max_daily_rainfall_mm, max_daily_rainfall_date, wet_days, dry_days} (wet ≥ 1.0 mm/day prototype heuristic),
- `advisories[]` each {level ∈ {info, watch}, topic, message, label=prototype}.

## Freshness (P0)

Staleness rule (identical in `src/utils/forecast_freshness.py`, `RealForecastService`, `app.js`/`portal.js`):

```
age_days = today − issue_date (calendar days)
expired  = today > valid_to
stale    = expired OR age_days > 2
```

- A stale package is a VALID state (the latest AVAILABLE CHIRPS-GEFS bundle may be
  older than today) and MUST be exposed: `/api/health` (`stale`, `age_days`,
  `generated_at`, `expires_at`), `/api/forecast/freshness`, and frontend banners.
- A stale forecast must NEVER render identically to a fresh one. Frontend shows
  `Issued <d> · Valid <a>–<b> · STALE/EXPIRED (<n>d old)`.
- Refresh procedure (no restart required when `saarthi.forecast.path` points at the
  NB06 package, else rebuild): re-run NB05 → NB06 → copy
  `data/processed/application/{latest_forecast.json,blocks.json,sangrur_blocks.geojson}`
  → `POST /api/forecast/reload`. On failure the previous forecast keeps serving.

`api/health.json` fixture mirrors the health response shape.

## NB05 vs NB06 representations

- NB05 internal (`data/processed/live_forecast/latest_block_forecast.json`): per-block
  `daily_rainfall_mm[7]`, flat `prob_low/prob_normal/prob_high`, `rainfall_category`,
  `max_daily_rainfall_day`, `context{soil…}`. Pipeline-internal only.
- NB06 public (`data/processed/application/latest_forecast.json` → served by the API):
  `system` + `forecast` (`daily_forecast[{date,day,rainfall_mm}]`, `probability{low,normal,high}`,
  `indicators`, `advisories`) + `summary`. Validated by `docs/api/forecast-schema.json`.

## Limits (must surface in UI)

7-day block outlook only; no village-level, onset-guarantee, yield, IOD/MJO/ERA5/SMAP/S2S claims. Method: Raw CHIRPS-GEFS (ML did not beat it). Dry-spell / "dry break" guidance is a prototype rainfall-deficit heuristic — not an IMD onset/break forecast. No IMD onset/withdrawal criteria are implemented.
