package com.altaweel.sakina;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * حفظ بطاقة الدعاء في معرض الصور، في ألبوم «Sakina».
 * أندرويد ١٠ وما بعده: عبر MediaStore دون أي إذن.
 * أندرويد ٨ و٩: يُطلب إذن التخزين عند الحفظ فقط.
 */
@CapacitorPlugin(name = "SakinaGallery", permissions = {
    @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public class SakinaGalleryPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29 && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storageCallback");
            return;
        }
        doSave(call);
    }

    @PermissionCallback
    private void storageCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) doSave(call);
        else call.reject("لم يُسمح بحفظ الصور");
    }

    /** حدّ لحجم الصورة (بعد فك Base64): بطاقة الدعاء أصغر بكثير */
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    /** اسم ملف آمن: حروف وأرقام وشرطات فقط، بامتداد png */
    static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "");
        if (n.startsWith(".")) n = n.substring(1);
        if (!n.toLowerCase(java.util.Locale.ROOT).endsWith(".png")) n = n + ".png";
        if (n.length() > 80) n = n.substring(n.length() - 80);
        return n.length() <= 4 ? "sakina.png" : n;
    }

    private void doSave(final PluginCall call) {
        final String data = call.getString("data", "");
        final String name = safeName(call.getString("name", "sakina.png"));
        if (data.length() > MAX_BYTES / 3 * 4 + 4) { call.reject("الصورة أكبر من المسموح"); return; }
        // فك الترميز والكتابة خارج خيط الواجهة
        new Thread(() -> {
            Uri uri = null;
            File file = null;
            ContentResolver r = getContext().getContentResolver();
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IllegalStateException("size");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Sakina");
                    v.put(MediaStore.Images.Media.IS_PENDING, 1);
                    uri = r.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("insert");
                    try (OutputStream o = r.openOutputStream(uri)) {
                        if (o == null) throw new IllegalStateException("stream");
                        o.write(bytes);
                    }
                    v.clear();
                    v.put(MediaStore.Images.Media.IS_PENDING, 0);
                    r.update(uri, v, null, null);
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Sakina");
                    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("mkdirs");
                    file = new File(dir, name);
                    try (FileOutputStream o = new FileOutputStream(file)) { o.write(bytes); }
                    MediaScannerConnection.scanFile(getContext(), new String[] { file.getAbsolutePath() }, new String[] { "image/png" }, null);
                }
                call.resolve();
            } catch (Exception e) {
                // لا يبقى سجل معلّق أو ملف ناقص
                if (uri != null) { try { r.delete(uri, null, null); } catch (Exception ignored) { } }
                if (file != null && file.exists()) file.delete();
                call.reject("تعذّر حفظ الصورة");
            }
        }).start();
    }
}
