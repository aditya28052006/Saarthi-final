package com.saarthi.weather;

import com.saarthi.service.RealForecastService;
import com.saarthi.service.RealForecastService.BlockNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Live weather endpoints (Open-Meteo delivery + ECMWF IFS NWP).
 * The legacy validated CHIRPS-GEFS endpoints under {@code /api/forecast/*}
 * are untouched; this controller only adds the {@code /api/weather/*} tree.
 */
@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final LiveWeatherService live;
    private final RecentRainfallService recent;
    private final RealForecastService blocks;

    @Autowired
    public WeatherController(LiveWeatherService live, RecentRainfallService recent,
            RealForecastService blocks) {
        this.live = live;
        this.recent = recent;
        this.blocks = blocks;
    }

    /** Live block-level forecast for all six blocks (16 daily dates). */
    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> allBlocks() {
        return ResponseEntity.ok(envelope(live.getForecast(false)));
    }

    /** Live block-level forecast for one block (id or name, case-insensitive). */
    @GetMapping("/forecast/{blockId}")
    public ResponseEntity<Map<String, Object>> oneBlock(@PathVariable("blockId") String blockId) {
        String canonical = blocks.findBlock(blockId)
                .map(b -> java.util.Objects.toString(b.get("block_name"), null))
                .orElseThrow(() -> new BlockNotFoundException(blockId));
        LiveWeatherService.LiveForecast fc = live.getForecast(false);
        LiveWeatherService.BlockForecast b = fc.blocks().get(canonical);
        if (b == null) {
            throw new WeatherUnavailableException("No live data for block '" + canonical + "'");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("provider", fc.provider());
        out.put("model", fc.model());
        out.put("issue_date", fc.issueDate().toString());
        out.put("retrieved_at", fc.retrievedAt().toString());
        out.put("stale", fc.stale());
        if (fc.staleWarning() != null) out.put("stale_warning", fc.staleWarning());
        out.put("horizon_days", b.days().size());
        out.put("block", toBlockMap(b));
        out.put("recent_observed", recent.observedLast(7));
        return ResponseEntity.ok(out);
    }

    /** Freshness of the cached live forecast (no upstream fetch). */
    @GetMapping("/freshness")
    public ResponseEntity<Map<String, Object>> freshness() {
        return ResponseEntity.ok(live.getFreshness());
    }

    private Map<String, Object> envelope(LiveWeatherService.LiveForecast fc) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("provider", fc.provider());
        out.put("model", fc.model());
        out.put("issue_date", fc.issueDate().toString());
        out.put("retrieved_at", fc.retrievedAt().toString());
        out.put("stale", fc.stale());
        if (fc.staleWarning() != null) out.put("stale_warning", fc.staleWarning());
        out.put("horizon_days", fc.horizonDays());
        out.put("horizon_note", "Days 1–7 operational · 8–15 extended/lower-confidence · "
                + "16–30 NOT served (no deterministic feed; not synthesised)");
        List<Map<String, Object>> list = fc.blocks().values().stream()
                .map(this::toBlockMap).toList();
        out.put("blocks", list);
        out.put("recent_observed", recent.observedLast(7));
        return out;
    }

    private Map<String, Object> toBlockMap(LiveWeatherService.BlockForecast b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("block_name", b.blockName());
        m.put("spatial_method", b.spatialMethod());
        m.put("days", b.days().stream().map(d -> {
            Map<String, Object> dm = new LinkedHashMap<>();
            dm.put("date", d.date().toString());
            dm.put("horizon_day", d.horizonDay());
            dm.put("rainfall_mm", d.rainfallMm());
            dm.put("rain_probability_pct", d.rainProbabilityPct());
            if (d.rainfallMm() == null) dm.put("note", "No data at any sample point; not zero");
            return dm;
        }).toList());
        m.put("cum_3d_mm", avail(b.cum3Mm(), 3));
        m.put("cum_7d_mm", avail(b.cum7Mm(), 7));
        m.put("cum_15d_mm", avail(b.cum15Mm(), 15));
        m.put("cum_30d", b.cum30());
        return m;
    }

    private Map<String, Object> avail(Double v, int n) {
        if (v == null) {
            return Map.of("available", false,
                    "reason", n + "-day total unavailable: fewer than " + n
                            + " valid forecast days (missing days are never zero-filled)");
        }
        return Map.of("available", true, "rainfall_mm", v);
    }

    /** Upstream failure with no cache: explicit 502, never synthetic data. */
    public static class WeatherUnavailableException extends RuntimeException {
        public WeatherUnavailableException(String message) {
            super(message);
        }
    }

    @ExceptionHandler(BlockNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleUnknownBlock(BlockNotFoundException ex) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("error", "unknown_block");
        err.put("message", ex.getMessage());
        err.put("valid_blocks", RealForecastService.BLOCKS);
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(err);
    }

    @ExceptionHandler(WeatherProviderException.class)
    public ResponseEntity<Map<String, Object>> handleProvider(WeatherProviderException ex) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("error", "provider_error");
        err.put("message", ex.getMessage());
        err.put("retry", "Retry later; no fallback forecast is synthesised");
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(err);
    }

    @ExceptionHandler(WeatherUnavailableException.class)
    public ResponseEntity<Map<String, Object>> handleUnavailable(WeatherUnavailableException ex) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("error", "forecast_unavailable");
        err.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(err);
    }
}
