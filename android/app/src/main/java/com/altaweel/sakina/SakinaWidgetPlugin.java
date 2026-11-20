package com.altaweel.sakina;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** يحفظ مواقيت الويدجت (نحو شهر) ويعيد رسمه؛ البيانات تبقى على الجهاز */
@CapacitorPlugin(name = "SakinaWidget")
public class SakinaWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        JSObject data = call.getData();
        String json = data == null ? "{}" : data.toString();
        if (json.length() > 200_000) { call.reject("too-big"); return; }
        Context ctx = getContext();
        ctx.getSharedPreferences(SakinaWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString(SakinaWidgetProvider.KEY_DATA, json).apply();
        SakinaWidgetProvider.refresh(ctx);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(SakinaWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        SakinaWidgetProvider.refresh(ctx);
        call.resolve();
    }
}
