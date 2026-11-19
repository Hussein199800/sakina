package com.altaweel.sakina;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * ويدجت الشاشة الرئيسية: المدينة والصلاة القادمة ووقتها، وزر يفتح الورد المناسب للوقت.
 * يقرأ مواقيت نحو شهر يرسلها التطبيق (SakinaWidgetPlugin)، ويتجدد بمنبّه غير دقيق عند كل صلاة،
 * فلا GPS في الخلفية ولا تحديث مستمر.
 */
public class SakinaWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "sakina_widget";
    static final String KEY_DATA = "data";
    static final String ACTION_TICK = "com.altaweel.sakina.WIDGET_TICK";
    private static final int TICK_ID = 8801;

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        refresh(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent == null ? null : intent.getAction();
        if (ACTION_TICK.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)
            || Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) refresh(ctx);
    }

    @Override
    public void onDisabled(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(tick(ctx));
    }

    /** ما يُعرض الآن: الصلاة القادمة والورد المناسب، محسوبان من القائمة المحفوظة */
    static final class Shown {
        String city = "";
        String prayer = "";
        String time = "";
        String wird = "morning";
        String wirdLabel = "أذكار الصباح";
        long nextAt = 0;
        boolean available = false;
    }

    static Shown compute(String json, long now) {
        Shown v = new Shown();
        try {
            JSONObject d = new JSONObject(json == null ? "{}" : json);
            v.city = d.optString("city", "");
            boolean arab = d.optBoolean("arab", true);
            TimeZone tz = TimeZone.getTimeZone(d.optString("tz", TimeZone.getDefault().getID()));
            JSONArray items = d.optJSONArray("items");
            JSONObject last = null;
            JSONObject next = null;
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject o = items.getJSONObject(i);
                long at = o.optLong("at", 0);
                if (at <= now) last = o;
                else { next = o; break; }
            }
            // الورد حسب آخر صلاة مضت: بعد الفجر الصباح، وبعد العصر المساء، وبعد العشاء النوم
            if (last != null) { v.wird = last.optString("wird", v.wird); v.wirdLabel = last.optString("wirdLabel", v.wirdLabel); }
            else if (next != null && "fajr".equals(next.optString("k"))) { v.wird = "sleep"; v.wirdLabel = "أذكار النوم"; }
            if (next != null) {
                v.available = true;
                v.prayer = next.optString("name", "");
                v.nextAt = next.optLong("at", 0);
                v.time = clock(v.nextAt, tz, arab);
            }
        } catch (Exception ignored) { }
        return v;
    }

    static String clock(long at, TimeZone tz, boolean arab) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(at);
        int h = c.get(Calendar.HOUR_OF_DAY);
        int m = c.get(Calendar.MINUTE);
        int h12 = h % 12 == 0 ? 12 : h % 12;
        String s = h12 + ":" + (m < 10 ? "0" : "") + m + " " + (h < 12 ? "ص" : "م");
        if (!arab) return s;
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            b.append(ch >= '0' && ch <= '9' ? (char) ('٠' + (ch - '0')) : ch);
        }
        return b.toString();
    }

    /** إعادة رسم كل نسخ الويدجت وجدولة التحديث التالي عند الصلاة القادمة */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SakinaWidgetProvider.class));
        if (ids == null || ids.length == 0) return;
        String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DATA, null);
        Shown v = compute(json, System.currentTimeMillis());
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_prayer);
        rv.setTextViewText(R.id.w_city, v.city);
        if (v.available) {
            rv.setTextViewText(R.id.w_prayer, "الصلاة القادمة: " + v.prayer);
            rv.setTextViewText(R.id.w_time, v.time);
        } else {
            rv.setTextViewText(R.id.w_prayer, json == null ? "افتح سكينة لعرض المواقيت" : "المواقيت غير متاحة");
            rv.setTextViewText(R.id.w_time, json == null ? "" : "افتح التطبيق لتحديثها");
        }
        rv.setTextViewText(R.id.w_wird, "افتح " + v.wirdLabel);
        rv.setOnClickPendingIntent(R.id.w_root, open(ctx, "/home", 1));
        rv.setOnClickPendingIntent(R.id.w_wird, open(ctx, "/read/" + v.wird, 2));
        mgr.updateAppWidget(ids, rv);
        schedule(ctx, v.nextAt);
    }

    private static PendingIntent open(Context ctx, String path, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("sakina://open" + path));
        i.setPackage(ctx.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent tick(Context ctx) {
        Intent i = new Intent(ctx, SakinaWidgetProvider.class);
        i.setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(ctx, TICK_ID, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void schedule(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = tick(ctx);
        am.cancel(pi);
        if (at <= 0) return;
        // منبّه غير دقيق كافٍ للعرض: لا يحتاج إذن المنبّهات الدقيقة
        am.setAndAllowWhileIdle(AlarmManager.RTC, at + 1000, pi);
    }
}
