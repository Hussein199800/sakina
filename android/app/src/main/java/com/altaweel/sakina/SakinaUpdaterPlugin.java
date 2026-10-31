package com.altaweel.sakina;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;

/**
 * تنزيل التحديث وتثبيته من داخل التطبيق.
 * قبل فتح المثبّت نتحقق أن الملف موقّع بالمفتاح نفسه للتطبيق المثبّت وأن رقم إصداره أحدث.
 */
@CapacitorPlugin(name = "SakinaUpdater")
public class SakinaUpdaterPlugin extends Plugin {
    // لا نقبل التنزيل إلا من صفحة إصدارات المستودع الرسمي
    private static final String ALLOWED_PREFIX = "https://github.com/Hussein199800/sakina/releases/";
    private volatile boolean busy = false;

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    /** صفحة «السماح بتثبيت التطبيقات من هذا المصدر» */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent i = Build.VERSION.SDK_INT >= 26
                ? new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))
                : new Intent(Settings.ACTION_SECURITY_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("تعذّر فتح الإعدادات");
        }
    }

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url", "");
        if (url == null || !url.startsWith(ALLOWED_PREFIX)) { call.reject("رابط غير مسموح", "BAD_URL"); return; }
        if (busy) { call.reject("التنزيل جارٍ بالفعل", "BUSY"); return; }
        busy = true;
        new Thread(() -> {
            try {
                File file = download(url);
                verify(file);
                install(file);
                JSObject r = new JSObject();
                r.put("status", "installing");
                call.resolve(r);
            } catch (UpdateError e) {
                call.reject(e.getMessage(), e.code);
            } catch (Exception e) {
                call.reject("تعذّر تنزيل التحديث", "NETWORK");
            } finally {
                busy = false;
            }
        }).start();
    }

    private static final class UpdateError extends Exception {
        final String code;
        UpdateError(String msg, String code) { super(msg); this.code = code; }
    }

    private File download(String address) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new UpdateError("تعذّر تجهيز مكان التنزيل", "STORAGE");
        File out = new File(dir, "sakina-update.apk");
        File part = new File(dir, "sakina-update.part");
        HttpURLConnection c = null;
        try {
            URL u = new URL(address);
            // متابعة التحويلات يدوياً (GitHub يحوّل إلى خادم الملفات)
            for (int hop = 0; hop < 6; hop++) {
                c = (HttpURLConnection) u.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(20000);
                c.setReadTimeout(30000);
                c.setRequestProperty("User-Agent", "Sakina-Updater");
                int code = c.getResponseCode();
                if (code >= 300 && code < 400) {
                    String loc = c.getHeaderField("Location");
                    c.disconnect();
                    if (loc == null || !loc.startsWith("https://")) throw new UpdateError("تحويل غير آمن", "BAD_URL");
                    u = new URL(loc);
                    continue;
                }
                if (code != 200) throw new UpdateError("الخادم لم يُرجع الملف (" + code + ")", "NETWORK");
                break;
            }
            long total = c.getContentLengthLong();
            try (InputStream in = c.getInputStream(); FileOutputStream fo = new FileOutputStream(part)) {
                byte[] buf = new byte[64 * 1024];
                long got = 0;
                int lastPct = -1;
                int n;
                while ((n = in.read(buf)) != -1) {
                    fo.write(buf, 0, n);
                    got += n;
                    int pct = total > 0 ? (int) (got * 100 / total) : -1;
                    if (pct != lastPct) {
                        lastPct = pct;
                        JSObject p = new JSObject();
                        p.put("percent", pct);
                        p.put("received", got);
                        p.put("total", total);
                        notifyListeners("progress", p);
                    }
                }
                if (total > 0 && got != total) throw new UpdateError("انقطع التنزيل قبل اكتماله", "NETWORK");
            }
        } finally {
            if (c != null) c.disconnect();
        }
        if (out.exists() && !out.delete()) throw new UpdateError("تعذّر استبدال الملف القديم", "STORAGE");
        if (!part.renameTo(out)) throw new UpdateError("تعذّر حفظ الملف", "STORAGE");
        return out;
    }

    @SuppressWarnings("deprecation")
    private void verify(File file) throws Exception {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo archive = pm.getPackageArchiveInfo(file.getPath(), flags);
        if (archive == null) throw new UpdateError("الملف المنزّل تالف، حاول مرة أخرى", "CORRUPT");
        PackageInfo installed = pm.getPackageInfo(ctx.getPackageName(), flags);
        if (!ctx.getPackageName().equals(archive.packageName)) throw new UpdateError("الملف ليس تحديثاً لسكينة", "MISMATCH");
        long newCode = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        long curCode = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
        if (newCode <= curCode) throw new UpdateError("لديك أحدث إصدار بالفعل", "NOT_NEWER");
        Signature[] a = signatures(archive);
        Signature[] b = signatures(installed);
        // إن تعذّرت قراءة التوقيع نترك الحكم لمثبّت أندرويد، فهو يرفض أي توقيع مختلف
        if (a != null && b != null && !Arrays.equals(a, b)) throw new UpdateError("توقيع الملف لا يطابق التطبيق المثبّت", "MISMATCH");
    }

    @SuppressWarnings("deprecation")
    private static Signature[] signatures(PackageInfo p) {
        if (Build.VERSION.SDK_INT >= 28) {
            if (p.signingInfo == null) return null;
            return p.signingInfo.hasMultipleSigners() ? p.signingInfo.getApkContentsSigners() : p.signingInfo.getSigningCertificateHistory();
        }
        return p.signatures;
    }

    private void install(File file) {
        Context ctx = getContext();
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }
}
