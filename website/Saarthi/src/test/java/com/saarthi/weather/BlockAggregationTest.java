package com.saarthi.weather;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Block means, cumulative windows and horizon availability (mocked points only).
 */
class BlockAggregationTest {

    private static WeatherProvider.LocationDailyForecast loc(double lat, Double... rains) {
        List<WeatherProvider.DailyPointValues> days = new ArrayList<>();
        LocalDate d = LocalDate.parse("2026-09-18");
        for (int i = 0; i < rains.length; i++) {
            days.add(new WeatherProvider.DailyPointValues(
                    d.plusDays(i), rains[i], 50.0, 32.0, 24.0, 60.0, 10.0));
        }
        return new WeatherProvider.LocationDailyForecast(lat, 75.8, days);
    }

    @Test
    void blockMeanAcrossPoints() {
        var agg = LiveWeatherService.aggregateBlock("Sangrur",
                List.of(loc(30.1, 10.0), loc(30.2, 20.0), loc(30.3, 30.0)),
                "multipoint_mean_n3_3x3_bbox_filtered",
                LocalDate.parse("2026-09-17"), Instant.now());
        assertEquals(20.0, agg.days().get(0).rainfallMm(), 1e-9);
        assertEquals(1, agg.days().get(0).horizonDay());
    }

    @Test
    void nullPointsIgnoredButAllNullStaysNull() {
        var agg = LiveWeatherService.aggregateBlock("Dhuri",
                List.of(loc(30.1, 10.0, null), loc(30.2, 20.0, null)),
                "m", LocalDate.parse("2026-09-17"), Instant.now());
        assertEquals(15.0, agg.days().get(0).rainfallMm(), 1e-9);
        assertNull(agg.days().get(1).rainfallMm(),
                "day null at every point must stay null, never 0");
    }

    @Test
    void cumulativesRequireFullValidWindow() {
        List<LiveWeatherService.BlockDaily> days = new ArrayList<>();
        LocalDate d = LocalDate.parse("2026-09-18");
        for (int i = 0; i < 16; i++) {
            days.add(new LiveWeatherService.BlockDaily(d.plusDays(i), i + 1, 2.0, 10.0));
        }
        assertEquals(6.0, LiveWeatherService.cumulative(days, 3), 1e-9);
        assertEquals(14.0, LiveWeatherService.cumulative(days, 7), 1e-9);
        assertEquals(30.0, LiveWeatherService.cumulative(days, 15), 1e-9);
    }

    @Test
    void shortHorizonLeavesLongerWindowsUnavailable() {
        List<LiveWeatherService.BlockDaily> days = new ArrayList<>();
        LocalDate d = LocalDate.parse("2026-09-18");
        for (int i = 0; i < 7; i++) {
            days.add(new LiveWeatherService.BlockDaily(d.plusDays(i), i + 1, 2.0, 10.0));
        }
        assertEquals(14.0, LiveWeatherService.cumulative(days, 7), 1e-9);
        assertNull(LiveWeatherService.cumulative(days, 15),
                "15-day total must be unavailable on a 7-day feed, not zero");
    }

    @Test
    void nullDayInvalidatesItsWindow() {
        List<LiveWeatherService.BlockDaily> days = List.of(
                new LiveWeatherService.BlockDaily(LocalDate.parse("2026-09-18"), 1, 2.0, 10.0),
                new LiveWeatherService.BlockDaily(LocalDate.parse("2026-09-19"), 2, null, 10.0),
                new LiveWeatherService.BlockDaily(LocalDate.parse("2026-09-20"), 3, 2.0, 10.0));
        assertNull(LiveWeatherService.cumulative(days, 3),
                "a null day must not be zero-filled into a cumulative total");
    }

    @Test
    void thirtyDayNeverServed() {
        var agg = LiveWeatherService.aggregateBlock("Sunam",
                List.of(loc(30.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
                        1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0)),
                "m", LocalDate.parse("2026-09-17"), Instant.now());
        assertEquals(16, agg.days().size());
        assertFalse((Boolean) agg.cum30().get("available"));
        assertTrue(agg.cum30().get("reason").toString().contains("16-day"));
    }
}
