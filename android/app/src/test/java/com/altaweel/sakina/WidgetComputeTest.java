package com.altaweel.sakina;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.TimeZone;
import org.junit.Test;

/** حساب ما يعرضه الويدجت من المواقيت المحفوظة */
public class WidgetComputeTest {
    private static final String DATA = "{\"city\":\"دمشق\",\"tz\":\"Asia/Damascus\",\"arab\":false,\"items\":["
        + "{\"k\":\"dhuhr\",\"name\":\"الظهر\",\"at\":1000,\"wird\":\"morning\",\"wirdLabel\":\"أذكار الصباح\"},"
        + "{\"k\":\"asr\",\"name\":\"العصر\",\"at\":2000,\"wird\":\"evening\",\"wirdLabel\":\"أذكار المساء\"},"
        + "{\"k\":\"maghrib\",\"name\":\"المغرب\",\"at\":3000,\"wird\":\"evening\",\"wirdLabel\":\"أذكار المساء\"}]}";

    @Test
    public void nextPrayerAndWirdFollowTheClock() {
        SakinaWidgetProvider.Shown v = SakinaWidgetProvider.compute(DATA, 1500);
        assertTrue(v.available);
        assertEquals("العصر", v.prayer);
        assertEquals(2000, v.nextAt);
        assertEquals("morning", v.wird);
        assertEquals("دمشق", v.city);
        v = SakinaWidgetProvider.compute(DATA, 2500);
        assertEquals("المغرب", v.prayer);
        assertEquals("evening", v.wird);
    }

    @Test
    public void unavailableWhenNoFutureTimesOrBadData() {
        assertFalse(SakinaWidgetProvider.compute(DATA, 9000).available);
        assertFalse(SakinaWidgetProvider.compute("not json", 0).available);
        assertFalse(SakinaWidgetProvider.compute(null, 0).available);
    }

    @Test
    public void clockUses12hAndDigits() {
        TimeZone utc = TimeZone.getTimeZone("UTC");
        assertEquals("1:05 م", SakinaWidgetProvider.clock(13 * 3600_000L + 5 * 60_000L, utc, false));
        assertEquals("١٢:٠٠ ص", SakinaWidgetProvider.clock(0, utc, true));
    }
}
