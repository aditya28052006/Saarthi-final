package com.saarthi.weather;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Weather API parsing, units and missing-data behaviour (mocked responses only).
 */
class OpenMeteoParserTest {

    private final OpenMeteoProvider provider =
            new OpenMeteoProvider("https://api.open-meteo.com", 25, null);

    static final String SINGLE = """
            {
              "latitude": 30.24, "longitude": 75.89, "generationtime_ms": 1.2,
              "utc_offset_seconds": 19800, "timezone": "Asia/Kolkata",
              "daily_units": {"precipitation_sum": "mm"},
              "daily": {
                "time": ["2026-09-18", "2026-09-19", "2026-09-20"],
                "precipitation_sum": [0.0, 12.4, null],
                "precipitation_probability_max": [5.0, 68.0, null],
                "temperature_2m_max": [33.1, 31.0, 30.0],
                "temperature_2m_min": [24.0, 23.5, 23.0]
              }
            }
            """;

    static final String MULTI = """
            [
              {"latitude": 30.39, "longitude": 75.80,
               "daily": {"time": ["2026-09-18"], "precipitation_sum": [1.5],
                         "precipitation_probability_max": [40.0],
                         "temperature_2m_max": [32.0], "temperature_2m_min": [24.0]}},
              {"latitude": 29.93, "longitude": 75.81,
               "daily": {"time": ["2026-09-18"], "precipitation_sum": [2.5],
                         "precipitation_probability_max": [50.0],
                         "temperature_2m_max": [33.0], "temperature_2m_min": [25.0]}}
            ]
            """;

    @Test
    void singleLocationParsesWithUnitsIntact() {
        List<WeatherProvider.LocationDailyForecast> locs = provider.parseResponse(SINGLE, 1);
        assertEquals(1, locs.size());
        assertEquals(3, locs.get(0).days().size());
        assertEquals("2026-09-18", locs.get(0).days().get(0).date().toString());
        assertEquals(0.0, locs.get(0).days().get(0).precipitationMm());
        assertEquals(12.4, locs.get(0).days().get(1).precipitationMm());
        assertEquals(68.0, locs.get(0).days().get(1).precipitationProbability());
        assertEquals(31.0, locs.get(0).days().get(1).temperatureMaxC());
    }

    @Test
    void nullPrecipitationIsPreservedNeverZeroFilled() {
        List<WeatherProvider.LocationDailyForecast> locs = provider.parseResponse(SINGLE, 1);
        assertNull(locs.get(0).days().get(2).precipitationMm(),
                "missing precipitation must stay null, not 0.0");
    }

    @Test
    void multiCoordinateArrayResponseParses() {
        List<WeatherProvider.LocationDailyForecast> locs = provider.parseResponse(MULTI, 2);
        assertEquals(2, locs.size());
        assertEquals(1.5, locs.get(0).days().get(0).precipitationMm());
        assertEquals(2.5, locs.get(1).days().get(0).precipitationMm());
    }

    @Test
    void providerErrorObjectThrows() {
        String err = "{\"error\": true, \"reason\": \"bad param\"}";
        WeatherProviderException e = assertThrows(WeatherProviderException.class,
                () -> provider.parseResponse(err, 1));
        assertTrue(e.getMessage().contains("bad param"));
    }

    @Test
    void missingDailyThrows() {
        assertThrows(WeatherProviderException.class,
                () -> provider.parseResponse("{\"latitude\": 1.0}", 1));
    }

    @Test
    void malformedJsonThrows() {
        assertThrows(WeatherProviderException.class,
                () -> provider.parseResponse("not json", 1));
    }

    @Test
    void requestUrlPinsModelTimezoneAndHorizon() {
        String url = provider.buildUrl(List.of(
                new WeatherProvider.SamplePoint(30.23743, 75.89491)));
        assertTrue(url.contains("models=ecmwf_ifs"), url);
        assertTrue(url.contains("timezone=Asia%2FKolkata"), url);
        assertTrue(url.contains("forecast_days=16"), url);
        assertTrue(url.contains("precipitation_sum"), url);
        assertTrue(url.contains("/v1/forecast?"), url);
    }

    @Test
    void noSecretsInRequest() {
        String url = provider.buildUrl(List.of(
                new WeatherProvider.SamplePoint(30.0, 75.8)));
        assertFalse(url.toLowerCase().contains("key="));
        assertFalse(url.toLowerCase().contains("token="));
    }

    @Test
    void mapperAvailable() {
        assertNotNull(new ObjectMapper());
    }
}
