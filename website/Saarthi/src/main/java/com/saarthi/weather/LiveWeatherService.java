package com.saarthi.weather;

import com.saarthi.service.RealForecastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Live block-level rainfall engine.
 *
 * <pre>
 *   Open-Meteo (ECMWF IFS) → sample points → block mean → daily forecast
 * </pre>
 *
 * <ul>
 *   <li>Daily rainfall = mean of {@code daily.precipitation_sum} across the
 *       block's inside-polygon sample points (Asia/Kolkata calendar days,
 *       provided pre-aggregated by Open-Meteo). Null point values are
 *       ignored; a day that is null at every point stays null (never zero).</li>
 *   <li>Horizon: 16 daily dates as served (days 1–7 operational, 8–15
 *       extended/lower-confidence, 16–30 NOT available — exposed as
 *       {@code available:false}, never synthesised).</li>
 *   <li>Cache: one provider call serves all blocks; results cached for
 *       {@code saarthi.weather.cache-ttl-minutes} (default 60). On provider
 *       failure a cached value is served ONLY with {@code stale:true} and an
 *       explicit warning; with no cache the failure surfaces as 502.</li>
 * </ul>
 */
@Service
public class LiveWeatherService {

    static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final WeatherProvider provider;
    private final BlockSampler sampler;

    @Value("${saarthi.weather.cache-ttl-minutes:60}")
    private long cacheTtlMinutes = 60;

    private volatile CachedForecast cache;

    @Autowired
    public LiveWeatherService(WeatherProvider provider, BlockSampler sampler) {
        this.provider = provider;
        this.sampler = sampler;
    }

    /** Test seam. */
    LiveWeatherService(WeatherProvider provider, BlockSampler sampler, long cacheTtlMinutes) {
        this.provider = provider;
        this.sampler = sampler;
        this.cacheTtlMinutes = cacheTtlMinutes;
    }

    /** Full live forecast for all 6 blocks (cached when fresh). */
    public synchronized LiveForecast getForecast(boolean forceRefresh) {
        CachedForecast c = cache;
        if (!forceRefresh && c != null && !isExpired(c)) {
            return c.forecast();
        }
        try {
            LiveForecast fresh = fetchFresh();
            cache = new CachedForecast(fresh, Instant.now());
            return fresh;
        } catch (WeatherProviderException e) {
            if (c != null) {
                // Explicit stale serve: never silent, warning travels with the payload.
                return c.forecast().withStaleWarning(
                        "Serving cached forecast: live provider failed (" + e.getMessage() + ")");
            }
            throw e;
        }
    }

    /** Freshness of the currently cached forecast (no fetch). */
    public synchronized Map<String, Object> getFreshness() {
        Map<String, Object> out = new LinkedHashMap<>();
        CachedForecast c = cache;
        if (c == null) {
            out.put("available", false);
            out.put("reason", "No live forecast retrieved yet; call GET /api/weather/forecast first");
            return out;
        }
        out.put("available", true);
        out.put("provider", provider.providerName());
        out.put("model", provider.modelName());
        out.put("model_run_time", null);
        out.put("model_run_note", "Open-Meteo exposes no per-run initialisation timestamp; retrieved_at is the freshness anchor");
        out.put("retrieved_at", c.retrievedAt.toString());
        out.put("age_minutes", ageMinutes(c));
        out.put("stale", isExpired(c));
        out.put("cache_ttl_minutes", cacheTtlMinutes);
        out.put("issue_date", c.forecast.issueDate().toString());
        return out;
    }

    private boolean isExpired(CachedForecast c) {
        return ageMinutes(c) >= cacheTtlMinutes;
    }

    private long ageMinutes(CachedForecast c) {
        return java.time.Duration.between(c.retrievedAt, Instant.now()).toMinutes();
    }

    private LiveForecast fetchFresh() {
        List<BlockSampler.SampleRef> refs = sampler.allPoints();
        List<WeatherProvider.SamplePoint> points = refs.stream()
                .map(BlockSampler.SampleRef::point).toList();
        List<WeatherProvider.LocationDailyForecast> locs = provider.fetch(points);
        if (locs.size() != points.size()) {
            throw new WeatherProviderException("Provider returned " + locs.size()
                    + " locations for " + points.size() + " sample points");
        }
        // Group location forecasts by block, preserving provider order.
        Map<String, List<WeatherProvider.LocationDailyForecast>> byBlock = new LinkedHashMap<>();
        for (String b : RealForecastService.BLOCKS) byBlock.put(b, new ArrayList<>());
        for (int i = 0; i < refs.size(); i++) {
            byBlock.get(refs.get(i).blockName()).add(locs.get(i));
        }
        LocalDate issueDate = LocalDate.now(IST);
        Instant retrievedAt = Instant.now();
        Map<String, BlockForecast> blocks = new LinkedHashMap<>();
        for (String b : RealForecastService.BLOCKS) {
            String method = sampler.samples().get(b).spatialMethod();
            blocks.put(b, aggregateBlock(b, byBlock.get(b), method, issueDate, retrievedAt));
        }
        return new LiveForecast(provider.providerName(), provider.modelName(), issueDate,
                retrievedAt, false, null, blocks);
    }

    /** Mean across sample points per date; all-null day stays null. Package-visible for tests. */
    static BlockForecast aggregateBlock(String blockName,
            List<WeatherProvider.LocationDailyForecast> locs,
            String spatialMethod, LocalDate issueDate, Instant retrievedAt) {
        Map<LocalDate, List<Double>> rainByDate = new TreeMap<>();
        Map<LocalDate, List<Double>> probByDate = new TreeMap<>();
        for (WeatherProvider.LocationDailyForecast loc : locs) {
            for (WeatherProvider.DailyPointValues d : loc.days()) {
                if (d.precipitationMm() != null) {
                    rainByDate.computeIfAbsent(d.date(), k -> new ArrayList<>()).add(d.precipitationMm());
                } else {
                    rainByDate.computeIfAbsent(d.date(), k -> new ArrayList<>());
                }
                if (d.precipitationProbability() != null) {
                    probByDate.computeIfAbsent(d.date(), k -> new ArrayList<>()).add(d.precipitationProbability());
                } else {
                    probByDate.computeIfAbsent(d.date(), k -> new ArrayList<>());
                }
            }
        }
        List<BlockDaily> days = new ArrayList<>();
        int horizon = 0;
        for (Map.Entry<LocalDate, List<Double>> e : rainByDate.entrySet()) {
            horizon++;
            Double rain = meanOrNull(e.getValue());
            Double prob = meanOrNull(probByDate.getOrDefault(e.getKey(), List.of()));
            days.add(new BlockDaily(e.getKey(), horizon, rain, prob));
        }
        return new BlockForecast(blockName, days,
                cumulative(days, 3), cumulative(days, 7), cumulative(days, 15),
                spatialMethod, issueDate, retrievedAt);
    }

    static Double meanOrNull(List<Double> values) {
        if (values == null || values.isEmpty()) return null;
        double sum = 0;
        for (double v : values) sum += v;
        return sum / values.size();
    }

    /**
     * Cumulative rainfall over the first {@code n} horizon days. Returns null
     * (unavailable) unless all {@code n} days exist with non-null rainfall —
     * never zero-fills missing future days.
     */
    static Double cumulative(List<BlockDaily> days, int n) {
        if (days.size() < n) return null;
        double sum = 0;
        for (int i = 0; i < n; i++) {
            Double v = days.get(i).rainfallMm();
            if (v == null) return null;
            sum += v;
        }
        return sum;
    }

    // ---- DTO records (serialised by Jackson) ----

    public record LiveForecast(String provider, String model, LocalDate issueDate,
            Instant retrievedAt, boolean stale, String staleWarning,
            Map<String, BlockForecast> blocks) {
        /** Horizon actually served (16 for ECMWF IFS via Open-Meteo). */
        public int horizonDays() {
            return blocks.values().stream().mapToInt(b -> b.days().size()).max().orElse(0);
        }

        LiveForecast withStaleWarning(String warning) {
            return new LiveForecast(provider, model, issueDate, retrievedAt, true, warning, blocks);
        }
    }

    public record BlockForecast(String blockName, List<BlockDaily> days,
            Double cum3Mm, Double cum7Mm, Double cum15Mm,
            String spatialMethod, LocalDate issueDate, Instant retrievedAt) {
        /** 30-day outlook is NOT served: provider horizon is 16 days; no synthesis. */
        public Map<String, Object> cum30() {
            return Map.of("available", false,
                    "reason", "30-day deterministic rainfall not available from the 16-day ECMWF IFS feed; "
                            + "days 16–30 require a probabilistic/climate-informed outlook (Phase 3), not synthesised here");
        }
    }

    public record BlockDaily(LocalDate date, int horizonDay,
            Double rainfallMm, Double rainProbabilityPct) {}

    private record CachedForecast(LiveForecast forecast, Instant retrievedAt) {
    }
}
