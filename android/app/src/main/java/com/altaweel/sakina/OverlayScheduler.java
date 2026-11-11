package com.altaweel.sakina;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * جدولة ظهور الفقاعة العائمة في أوقات محددة عبر AlarmManager.
 * تُحفظ القائمة في SharedPreferences لإعادة جدولتها بعد إعادة تشغيل الهاتف.
 */
public final class OverlayScheduler {
    static final String PREFS = "sakina_overlay";
    static final String KEY_ITEMS = "items";
    static final String KEY_IDS = "ids";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_ROUTE = "route";
    static final String ACTION_SHOW = "com.altaweel.sakina.SHOW_BUBBLE";
    static final String KEY_SNOOZE = "snooze";
    static final String KEY_QUIET = "quiet";
    /** معرّف ثابت للتأجيل: تأجيل جديد يستبدل السابق فلا تتكرر الفقاعة */
    static final int SNOOZE_ID = 6999;

    private OverlayScheduler() {}

    /** يستبدل كل المواعيد السابقة بالقائمة الجديدة (JSON: [{id, at, title, body, route}]) */
    public static void schedule(Context ctx, String json) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelAll(ctx, p.getString(KEY_IDS, "[]"));
        JSONArray ids = new JSONArray();
        try {
            JSONArray items = new JSONArray(json == null ? "[]" : json);
            long now = System.currentTimeMillis();
            for (int i = 0; i < items.length(); i++) {
                JSONObject o = items.getJSONObject(i);
                long at = o.optLong("at", 0);
                int id = o.optInt("id", 0);
                if (at <= now || id == 0) continue;
                set(ctx, id, at, o.optString("title"), o.optString("body"), o.optString("route", "/home"));
                ids.put(id);
            }
        } catch (Exception ignored) { }
        p.edit().putString(KEY_ITEMS, json == null ? "[]" : json).putString(KEY_IDS, ids.toString()).apply();
    }

    /** إعدادات الفقاعة من التطبيق: مدد التأجيل بالدقائق، وساعات الهدوء {on, from, to} بالدقائق من منتصف الليل */
    public static void config(Context ctx, String snoozeJson, String quietJson) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_SNOOZE, snoozeJson == null ? "[5,15,30,60]" : snoozeJson)
            .putString(KEY_QUIET, quietJson == null ? "{}" : quietJson).apply();
    }

    static int[] snoozeMinutes(Context ctx) {
        try {
            JSONArray a = new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNOOZE, "[5,15,30,60]"));
            int n = 0;
            int[] tmp = new int[a.length()];
            for (int i = 0; i < a.length(); i++) { int m = a.getInt(i); if (m > 0 && m <= 720) tmp[n++] = m; }
            if (n > 0) { int[] out = new int[n]; System.arraycopy(tmp, 0, out, 0, n); return out; }
        } catch (Exception ignored) { }
        return new int[] { 5, 15, 30, 60 };
    }

    /** هل الوقت الحالي داخل ساعات الهدوء؟ (تمتد عبر منتصف الليل إذا كانت البداية بعد النهاية) */
    static boolean inQuiet(Context ctx, long at) {
        try {
            JSONObject q = new JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_QUIET, "{}"));
            if (!q.optBoolean("on", false)) return false;
            int from = q.optInt("from", 0), to = q.optInt("to", 0);
            java.util.Calendar c = java.util.Calendar.getInstance();
            c.setTimeInMillis(at);
            int m = c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE);
            return from <= to ? (m >= from && m < to) : (m >= from || m < to);
        } catch (Exception e) {
            return false;
        }
    }

    /** إعادة إظهار التذكير نفسه بعد مدة يختارها المستخدم */
    public static void snooze(Context ctx, int minutes, String title, String body, String route) {
        set(ctx, SNOOZE_ID, System.currentTimeMillis() + minutes * 60_000L, title, body, route);
    }

    /** بعد إعادة تشغيل الهاتف أو تحديث التطبيق */
    public static void restore(Context ctx) {
        schedule(ctx, ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ITEMS, "[]"));
    }

    private static PendingIntent intent(Context ctx, int id, String title, String body, String route) {
        Intent i = new Intent(ctx, OverlayReceiver.class);
        i.setAction(ACTION_SHOW);
        i.putExtra(EXTRA_TITLE, title);
        i.putExtra(EXTRA_BODY, body);
        i.putExtra(EXTRA_ROUTE, route);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void set(Context ctx, int id, long at, String title, String body, String route) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = intent(ctx, id, title, body, route);
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }

    private static void cancelAll(Context ctx, String idsJson) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            JSONArray ids = new JSONArray(idsJson);
            for (int i = 0; i < ids.length(); i++) am.cancel(intent(ctx, ids.getInt(i), "", "", ""));
        } catch (Exception ignored) { }
    }
}
