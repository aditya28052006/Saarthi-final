# 07 — Current Decisions (Decision Log)

> **Log of important decisions made during this session.** Each decision lists *Decision, Reason, Consequence*. Do not silently reverse these without updating this log.

---

### 1. Sangrur Six-Block Legacy Bhuvan Geography

**Decision:** Use **exactly 6 legacy Bhuvan/ISRO blocks** (`Dhuri, Lehra, Malerkotla, Moonak, Sangrur, Sunam`) from `sangrur_blocks_bhuvan.gpkg:184320` layer `sangrur_blocks` as the **authoritative, sole spatial unit** for the prototype.

**Reason:** SIH prototype was already established on the legacy 6-block representation; the current 8-block administrative structure would change the spatial join, the `6×` block-level samples, and all downstream joins. The synthetic `sangrur_blocks.shp:916` was only a temporary test artifact.

**Consequence:** All zonal stats, maps, and `6×` joins use `b_name` from the GPKG (`MultiPolygon` irregular, `12-28` pixels/block varying). The 8-block dataset must be ignored unless explicitly instructed.

---

### 2. Bhuvan GeoPackage as Authoritative Boundary (Not Synthetic Shapefile)

**Decision:** `data/raw/boundaries/sangrur_blocks_bhuvan.gpkg:184320` (`6` `MultiPolygon`, `OGC:CRS84`, `75.55-76.20`) is the **authoritative** boundary. `sangrur_blocks.shp:916` (`Polygon ×6` rectangular `48` uniform) remains in the repo **only as a fallback/test artifact** and must **not** be used by `01`/`02` pipelines (both now explicitly prefer `*_bhuvan.gpkg`).

**Reason:** The Bhuvan parcel `bhuvan_blocks.parquet:97298502` (6393 national, 74 Punjab) filtered `s_name=="Punjab" AND d_name=="Sangrur"` was verified to produce exactly the 6 expected blocks with correct names and irregular geometries. The synthetic grid was `75.55-76.45` 2×3 rectangles, not administrative.

**Consequence:** `01` `c11_load_boundaries:1` and `02` `c3_boundaries:1` now do `gpd.read_file(bhuvan_gpkg, layer="sangrur_blocks")` and log `Using AUTHORITATIVE GeoPackage`. All `12-28` varying pixel counts prove real admin is used.

---

### 3. CHIRPS v3 as Observed / Ground Truth

**Decision:** Use **CHIRPS v3** `data/raw/rainfall/Sangrur_Block_Daily_Rainfall_2010_2025.csv:3804691` (`35064` rows `2010-01-01` to `2025-12-31`, `6` per date) as the **sole observed rainfall source** for both historical features (≤`D`) and the **target** `target_7d = sum D+1..D+7`.

**Reason:** CHIRPS v3 is the `0.05°` quasi-global, 40+ year, `60N-60S` dataset on which CHIRPS-GEFS is calibrated (`c3g_` = CHIRPS3-GEFS). It is already aggregated to the 6 Sangrur blocks, continuous (no missing dates), and validated in `02` `Cell 13`.

**Consequence:** `02` `Cell 14` must validate `D+1..D+7` all have 6 blocks; early `2001-2009` `D` are automatically `invalid` (no CHIRPS target yet) — `8758→5472` valid. The intended `2001–2019` train must be **restricted to `2010–2019`** unless earlier CHIRPS is acquired.

---

### 4. CHIRPS-GEFS v3 Daily as Forecast Predictor

**Decision:** Use **CHIRPS-GEFS v3 daily** `https://data.chc.ucsb.edu/products/CHIRPS-GEFS/v3/daily/global/YYYY/MM/DD/c3g_YYYY.MM.DD.tif` (`7200×2400×1` `64.9 MB` `float32` `EPSG:4326`) as the **most important predictor**.

**Reason:** It is the CHIRPS-calibrated GEFS forecast (`c3g`), bias-corrected, `0.05°`, `60N-60S`, with pre-2000 reformats and operational `2000–2019` + `2021–2025` archive (2020 gap) — directly comparable to CHIRPS.

**Consequence:** Historical system simulates `At D, use GEFS issued on D, compare to CHIRPS D+1..D+7`. Archive is date-based folders with `c3g_YYYY.MM.DD.tif` per date.

---

### 5. Seven-Day Primary Target

**Decision:** **Primary target is 7-day accumulated observed rainfall** `target_7d_rainfall_mm = sum CHIRPS D+1..D+7` per `forecast_date+block`. `D` itself **must NOT** be included, nor `D+8`.

**Reason:** SIH asks for 7–30 day hyperlocal outlook; 7-day is the focused prototype that balances skill and demo feasibility. A 7-day window is also the most actionable for agricultural advisories.

**Consequence:** `02` `Cell 28` builds `target_7d` with `target_start = D+1`, `target_end = D+7`, requires 7 valid days, `target_valid=False` if any missing (no zero fill). Secondary `target_10d` only if core 7-day works.

---

### 6. Shared Model Across Six Blocks with `lat/lon`

**Decision:** Train **one shared model** across all 6 blocks, not 6 independent models. Represent spatial differences via `centroid latitude, longitude` (from `sangrur_blocks_bhuvan.gpkg`) + soil.

**Reason:** `PROJECT_CONTEXT` explicitly says *do not initially train six completely independent models*; a shared model can learn `history + forecast + ENSO + season + location + soil` jointly.

**Consequence:** `Notebook 03` will add `latitude, longitude` per block; block ID is not the only spatial feature.

---

### 7. Recent Rainfall Features (≤D Only)

**Decision:** Later `Notebook 03` will add `rain_1d, rain_3d, rain_7d, rain_14d, rain_30d` (sums ending at `D`) and `rain_lag_1..7` (`rain_lag_1 = D, ..., rain_lag_7 = D-6`).

**Reason:** Recent observed rainfall is a strong predictor, but must be **strictly ≤D** to avoid leakage.

**Consequence:** For `D=2019-09-04`, `rain_7d = sum 2019-08-29..2019-09-04`, never `2019-09-05`.

---

### 8. Chronological Validation (No Random Split)

**Decision:** **Never randomly shuffle** `forecast_date`. Use **chronological** splits, keep `2020` excluded.

**Intended (adapted to `2010` CHIRPS start):** `2010–2019` train / `2021–2023` val / `2024–2025` test (original `2001–2019` train is truncated to `2010–2019` because `2001-2009` has no target). `CANDIDATE_DATES 8758 → VALID_DATES 5472` already enforces chronological, `2020` excluded, `D+7 ≤ 2025-12-31`.

**Reason:** Time series with seasonality and autocorrelation; random split leaks future `D+1..D+7` into train via overlapping windows.

**Consequence:** `Notebook 04` will do `df[year <=2019]` etc., no `train_test_split(random_state=)`.

---

### 9. RF / XGBoost / LightGBM Candidates, No Winner Yet

**Decision:** Compare **Climatology, Persistence, Raw GEFS** baselines vs **Random Forest, XGBoost, LightGBM** — all tabular tree models. **No model declared winner yet.**

**Reason:** `PROJECT_CONTEXT` says choose on **unseen chronological test performance** (`MAE/RMSE/R²` + `Accuracy/F1/log loss/Brier`), not on popularity. Deep learning is explicitly **not** part of core prototype unless core is complete and substantial time remains.

**Consequence:** `Notebook 04` will train all 6 and select objectively.

---

### 10. CSV + Parquet for `Cell 35`

**Decision:** `Cell 35` saves **both** `data/processed/forecast_features_base.csv:1294` and `.parquet:5982` (and `01` saves both for `chirps_gefs_sangrur_*`).

**Reason:** User explicitly requested `csv + parquet` — Parquet is the preferred downstream format (efficient), CSV is human-readable/debugging/export.

**Consequence:** `Notebook 03` can read either; Parquet is preferred for `32k` rows.

---

### 11. Explicit `NaN` for `gefs_d2..d7`

**Decision:** `Cell 35` schema is `forecast_date,block,gefs_d1,gefs_d2,gefs_d3,gefs_d4,gefs_d5,gefs_d6,gefs_d7,target_7d_rainfall_mm` where **`gefs_d1` is real** (from single daily file at `D`), **`gefs_d2..d7` are `NaN`** (not zero, not dropped) — `NaN` means “not available yet, to be filled in Notebook 03 by joining 7 daily files per `D`”.

**Reason:** Current single-daily product has `count 1` (`descriptions (None,)`), not a 7-band stack. `gefs_d2..d7` cannot be invented; `NaN` correctly represents missing, `0` would be wrong (would imply 0 mm forecast).

**Consequence:** `Cell 34` does **not** mark `gefs_d2..d7` all-`NaN` as `FAIL`; it reports `gefs_d1 0 missing PASS` and `gefs_d2..d7 all NaN — expected at this stage (to be filled in Notebook 03)`. `Notebook 03`'s job is to acquire/join the remaining daily files.

---

### 12. Six-Day Scope Constraint

**Decision:** Prioritize **correct pipeline → backtest → baselines → RF/XGB/LGBM → probabilistic → live → dashboard** in six days, in that order. Avoid expanding to `IOD, MJO, ERA5, SMAP, DEM, ECMWF S2S` etc. unless core is complete.

**Reason:** `PROJECT_CONTEXT` explicitly says the prototype must prioritize correct functioning over maximizing datasets.

**Consequence:** `02` `Cells 31–35` are a demo `3` dates (`18` rows) / `4` dates (`24` rows) `forecast_features_base` with `gefs_d1` only, not full `5472` bulk — full `5472` (`346 GB` raw) is a one-time background job with `KEEP_RAW=False`.

---

### 13. No Deep Learning Initially

**Decision:** No deep learning for core prototype.

**Reason:** Tabular `forecast_date+block` with `~32k` samples is well-suited to `RF/XGB/LightGBM`; deep learning adds overhead without clear gain for this prototype and is explicitly excluded in `PROJECT_CONTEXT`.

**Consequence:** If core `01–06` + dashboard are complete and time remains, deep learning could be *considered* as an extension, not a replacement.

---

### 14. Notebook 04 Winner: Raw GEFS (Honest Baseline Win, 2026-09-10)

**Decision:** Declare **Raw GEFS (`gefs_7d_total`)** the winning model (val MAE 19.031, test MAE 19.539) over RF/XGB/LGBM, and report that ML does not add skill on this JJAS task — rather than forcing an ML winner.

**Reason:** Selection was strictly lowest validation MAE per the agreed rule; test confirmed it (RF 20.176 / XGB 21.082 / LGBM 21.344). Hiding this would be dishonest and would corrupt downstream inference.

**Consequence:** `models/best_model.joblib` stores the baseline rule (reload-verified); feature importances shown are the best-ML (XGBoost) supplement, labeled as such. Future work (more seasons, calibrated post-processing) may revisit, but must beat 19.539 test MAE honestly.

---

### 15. Inference Artifacts + Live Pipeline (2026-09-10)

**Decision:** NB04 produces explicit inference artifacts (`best_model.joblib` with `model_type: raw_gefs`, `models/inference_config.json`, `models/probability_calibration.npz` holding the winner's train-residual ECDF + thresholds); NB05 consumes them without refitting anything, branching on `model_type` instead of assuming `.predict(X)`.

**Reason:** The winner is a rule, not an estimator; probabilities must reuse NB04's exact residual-ECDF methodology with train-only parameters. Lead 0 is forbidden by config flag.

**Consequence:** Live issue date D = latest fully-available GEFS bundle (walk-back ≤30d on gaps, else fail loudly); prediction = sum of D+1..D+7 block means; wet day ≥1.0 mm/day is a labeled prototype heuristic; CHIRPS/ENSO/soil are explicitly-flagged context only (NaN + availability flags when local files lag D, never fabricated).

---

### 16. Application Data Contract (2026-09-10)

**Decision:** NB06 packages NB05 output into `data/processed/application/` with Bhuvan-derived block IDs (`bhuvan_b_<b_code>`), static GeoJSON kept separate from dynamic forecast JSON, generic prototype-labeled advisories (no agronomic claims), and Spring Boot fixtures + `docs/api/` contract. No Streamlit/Flask/FastAPI; backend = Spring Boot, frontend = React.

**Reason:** Backend needs a stable, validated, reload-verified contract; geometry and forecast must version independently.

**Consequence:** Spring Boot DTOs bind directly to `latest_forecast.json`/`blocks.json`/`health.json`; React renders map + cards + charts from JSON (CSV is compatibility-only).

---

### 17. Saarthi Full-Stack Integration (2026-09-10)
**Decision:** Integrate the validated NB06 package into the existing Saarthi app (Spring Boot + vanilla HTML/JS/CSS + Leaflet — NO React migration, NO Streamlit/Flask) on branch `real-forecast-integration`, replacing the synthetic engine end-to-end while preserving UI structure.

**Reason:** Round-1 app used hardcoded 8-block data, 0.15 stub probability, pattern-math forecasts and false RF/92.4% claims; the validated contract (`data/processed/application/`) is the2014 fix point.

**Consequence:** New `RealForecastService` (classpath `forecast/` resources, fail-loud validation) is the single source of truth; endpoints `/health /blocks /blocks/geojson /forecast/latest /forecast/{blockId} /forecast/summary /advisories/{blockId} /panchayats /farmer-analysis` serve real data; frontend is fetch-first with 6-block GeoJSON polygons, 7-day-only UI, explicit error messages (no silent synthetic fallback); farmer analysis driven by real P(LOW); verified end-to-end (API + Playwright browser tests, 0 console errors).

---

*All decisions above are reflected in the current code and must be preserved. If a decision needs to change, update this file and `00_MASTER_CONTEXT.md` together.*

### 18. MJO + Climate-Context Extension (2026-09-11)

**Decision:** Ship compact CNN-LSTM MJO forecaster as validated climate CONTEXT ONLY (test beats persistence: RMM1 0.627 vs 0.884); keep Raw GEFS rainfall winner; IOD stays fail-soft Unavailable (no OISST locally, no fabrication); website gains `/api/climate-context` + `/api/mjo/latest` + context card.

**Reason:** No held-out experiment showed climate features beating GEFS, so honesty requires context-only. Time budget forced accepting IOD BLOCKED.

**Consequence:** Demo story = GEFS rainfall + MJO/ENSO context + IOD method documented; `07_IOD_CNN_LSTM` remains future work.

### 19. IOD LightGBM Result — Honest Persistence Win (2026-09-11)

**Decision:** Ship LightGBM IOD forecaster as experimental context (test MAE 0.1936 vs persistence 0.1573 — persistence wins, reported as-is); display live DMI +0.033 Neutral (2026-06, stale-flagged) with model label; keep rainfall untouched.

**Reason:** Monthly HadISST DMI (1,877 rows) supports a valid pipeline but not superiority; hiding this would corrupt the demo story.

**Consequence:** Climate card shows IOD available+stale; integration decision stays USE CLIMATE CONTEXT ONLY.

---
### 20. Frozen GEFS Dataset — Phase 1B.1 Ingestion Complete (2026-09-17)

**Decision:** Raw NOAA GEFS APCP dataset ingested and frozen for the SAARTHI Phase 1B comparison arm. All 610 dates fully processed; dataset is closed for modifications unless a genuine integrity issue is found.

**Reason:** Phase 1B.1 completed bounded 25-date batches until 366/366 test dates, 610/610 total dates, and 25,620 × 14 parquet were achieved. The dataset is now the authoritative baseline for the GEFS comparison arm. No further ingestion runs should be performed unless new dates or data sources require addition.

**Consequence:**
- `data/processed/phase1b/raw_gefs_apcp_leads.parquet` is the authoritative frozen artifact: exactly 25,620 rows × 14 columns, 610 unique forecast dates, 42 rows per date, leads 1–7 only, six legacy Sangrur blocks (Dhuri, Lehra, Malerkotla, Moonak, Sangrur, Sunam).
- 2018-07-15 is intentionally excluded (GEFS v11-era exclusion by design; different model from v12, excluded from raw-APCP arm; CHIRPS-GEFS baseline covers this period).
- 15 failed dates recorded in manifest: `2018-07-15` (v11 exclusion) + 14 dates from historical network/availability attempts. The 14 non-v11 failed dates must NOT be treated as incomplete since their data is already present in the final parquet (42 rows each, no incomplete groups).
- Train/validation/test split convention preserved: val = 244 dates (2021–2022), test = 366 dates (2023–2025). No train dates in the parquet split (2016–2019 years are excluded from the raw-APCP arm by design; CHIRPS-GEFS baseline covers those years consistently).
- All zonal statistics use the 6 legacy Bhuvan blocks from `sangrur_blocks_bhuvan.gpkg:184320` layer `sangrur_blocks`.
- No model retraining, IFS/AIFS work, or rainfall methodology changes are permitted on the basis of this dataset.
- Dataset is immutable: any future additions must be in a new phase (1B.3+) and must not modify the existing 25,620 × 14 artifact.

**Frozen GEFS Convention (immutable):**
- 00Z initialization only
- Lead 1 through Lead 7 only (lead 0 excluded)
- Forecast buckets f030 through f192 (D+1 through D+7)
- Six legacy Sangrur Bhuvan blocks: Dhuri, Lehra, Malerkotla, Moonak, Sangrur, Sunam
- APCP 6-h bucket accumulation: [H-6, H] in kg/m² == mm
- Pre-2021 operational GEFS is v11 (1.0 grid, undecodable range slices) — excluded by design
- 2018-07-15 is the single v11-era exclusion date (recorded in manifest failed_dates, excluded from parquet)
- CHIRPS-GEFS v3 is the existing rainfall baseline; this dataset is the new comparison arm
- Area-weighted zonal means over 6 blocks using `all_touched=True` geometry mask at 0.25-degree resolution
- Ensemble mean (v12-31mem, 31 members + geavg) for v12 era (2021+)

---
*All decisions above are reflected in the current code and must be preserved. If a decision needs to change, update this file and `00_MASTER_CONTEXT.md` together.*

### 21. Phase 1B.3 Fair Common-Period Result — CHIRPS-GEFS Carried Forward (2026-09-18)

**Decision:** Carry forward **CHIRPS-GEFS** as the rainfall source on the empirical common-period result; keep the frozen raw GEFS APCP parquet untouched as a documented comparison arm.

**Reason:** On the genuinely common 610-date JJAS set (2021-06-01..2025-09-30, 25,620 daily rows/arm, 3,660 7-day forecasts/arm, 00Z, leads D+1..D+7, frozen T33/T66), CHIRPS-GEFS 7-day MAE 19.336 / R² 0.338 beats raw GEFS APCP 7-day MAE 20.457 / R² 0.246 (ΔMAE +1.121, ΔR² −0.092 favouring CHIRPS-GEFS); daily overall MAE 4.087 vs 4.153 (Δ +0.066). Test-slice reproduction check passes (CHIRPS-GEFS test MAE 19.539 ≈ frozen 19.54). Repro: `python src/evaluation/phase1b_3_common_evaluation.py` → `data/processed/phase1b/phase1b_3_*` + `reports/phase1b/PHASE1B_3_GEFS_VS_CHIRPSGEFS_REPORT.md`.

**Consequence:**
- No frozen source parquet/CSV modified; no downloads; no retraining; no threshold/geography changes.
- Prior `phase1b_comparison_report.json` (34-date partial GEFS arm) is superseded for comparison purposes by `phase1b_3_common_report.json`; it is left in place, not deleted.

### 22. Phase 1B.4 IFS Access Check — TIGGE History BLOCKED, No Download (2026-09-18)

**Decision:** STOP before any IFS download; historical IFS ENS acquisition is BLOCKED on credentials. No files under `data/processed/phase1b/` were modified in this phase.

**Reason:** Access check 2026-09-18 confirmed: (a) intended history source is TIGGE via ECDS portal/MARS (registration + SSO required) — no anonymous bulk route; (b) no credentials in this environment (no `ECMWF_API_KEY`/`ECMWF_API_URL`/`MARS_API_KEY`, no `~/.ecmwfrc`/`~/.ecmwfapirc`); (c) `ecmwf-opendata` + `eccodes` are installed but Open Data keeps only the last ~12 runs (live/format-validation only, not 2016–2025 history); (d) existing `src/data/build_ifsens_leads.py` already encodes this honestly (`--tigge` fails loudly, `--opendata-test` proven 2026-09-15 on 2 live `ifs-hres` deterministic dates, NOT the ENS headline). Re-running `--opendata-test` would append live deterministic rows unrelated to the historical ENS task, so it was deliberately not run.

**Consequence:**
- To unblock, user must: register at `ecmwf.int`, request MARS/TIGGE access, configure credentials, then run `python src/data/build_ifsens_leads.py --tigge YYYY-MM-DD` for a one-date pilot, then bounded JJAS acquisition (2016–2019 / 2021–2022 / 2023–2025, 00Z, tp steps 0..168 differenced to D+1..D+7, 6 Bhuvan blocks). Estimated volume once unblocked: ~4 MB tp-only per init × ~1098 JJAS inits ≈ ~4.4 GB + processing.
- Frozen GEFS parquet untouched; no retraining; no threshold/geography changes; Phase 1B.5 three-way comparison stays pending.

### 23. Phase 1+2 Live Operational Weather — Open-Meteo + ECMWF IFS (2026-09-19)

**Decision:** SAARTHI's live rainfall outlook is now served from an operational NWP feed — Open-Meteo delivery layer + ECMWF IFS model (`models=ecmwf_ifs`, 16 `Asia/Kolkata` days) — aggregated to the 6 legacy Sangrur blocks. New additive endpoints `GET /api/weather/forecast`, `/forecast/{blockId}`, `/freshness`; timeline page shows a "Live Operational Outlook" card. Historical TIGGE/IFS bulk acquisition is no longer required for the live product.

**Reason:** Live-verified 2026-09-19 (keyless HTTP 200, 16 daily dates, 384 hourly steps, units mm/°C/%/km/h; backend smoke: 6 blocks × 16 days, multipoint n4–n7, no centroid fallback; weather tests 30/30). SAARTHI does NWP nowhere — its value is block downscaling, freshness guarantees, and farm advisories. Full rationale: `docs/project_context/11_LIVE_WEATHER_ARCHITECTURE.md`.

**Consequence:**
- CHIRPS-GEFS/GEFS work (decisions 20–22) retained as historical validation/background; `/api/forecast/*` legacy endpoints, NB01–NB06, frozen parquets, thresholds, and geography unchanged.
- Days 1–7 operational, 8–15 extended/lower-confidence, 16–30 NOT served (never synthesised); missing rainfall stays null, never zero-filled.
- SAARTHI makes no outperformance claim vs ECMWF IFS. Phase 3 adds ENSO/IOD/MJO climate intelligence for days 16–30 and agricultural risk, strictly separate from the deterministic feed.
