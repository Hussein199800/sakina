package com.altaweel.sakina;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** جسر الفقاعة العائمة بين واجهة التطبيق وأندرويد */
@CapacitorPlugin(name = "SakinaOverlay")
public class SakinaOverlayPlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", true);
        r.put("granted", BubbleView.canShow(getContext()));
        call.resolve(r);
    }

    /** يفتح صفحة إذن «الظهور فوق التطبيقات الأخرى» لهذا التطبيق */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("تعذّر فتح الإعدادات");
        }
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items", new JSArray());
        JSArray snooze = call.getArray("snooze", null);
        JSObject quiet = call.getObject("quiet", null);
        OverlayScheduler.config(getContext(), snooze == null ? null : snooze.toString(), quiet == null ? null : quiet.toString(), !"latn".equals(call.getString("digits", "arab")));
        OverlayScheduler.schedule(getContext(), items.toString());
        call.resolve();
    }

    @PluginMethod
    public void showNow(PluginCall call) {
        if (!BubbleView.canShow(getContext())) {
            call.reject("لا يوجد إذن الظهور فوق التطبيقات");
            return;
        }
        BubbleView.show(getContext(), call.getString("title", "سكينة"), call.getString("body", ""), call.getString("route", "/home"));
        call.resolve();
    }
}
