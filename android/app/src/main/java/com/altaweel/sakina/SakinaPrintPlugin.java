package com.altaweel.sakina;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * طباعة تقرير HTML عربي عبر نافذة الطباعة في أندرويد، ومنها «حفظ كملف PDF».
 * يُرسم التقرير في WebView خارج الشاشة فيبقى الخط العربي واتجاهه سليمين.
 */
@CapacitorPlugin(name = "SakinaPrint")
public class SakinaPrintPlugin extends Plugin {
    // مرجع حتى لا يُحذف العرض قبل انتهاء الطباعة؛ يُحرَّر عند انتهاء مهمة الطباعة
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String title = call.getString("title", "سكينة");
        getActivity().runOnUiThread(() -> {
            try {
                release();
                final WebView wv = new WebView(getActivity());
                // تقرير ثابت: لا JavaScript ولا وصول للملفات
                WebSettings ws = wv.getSettings();
                ws.setJavaScriptEnabled(false);
                ws.setAllowFileAccess(false);
                ws.setAllowContentAccess(false);
                final boolean[] done = { false };
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (done[0]) return; // تُستدعى أحياناً أكثر من مرة
                        done[0] = true;
                        try {
                            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            final PrintDocumentAdapter inner = view.createPrintDocumentAdapter(title);
                            PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                                @Override
                                public void onStart() { inner.onStart(); }
                                @Override
                                public void onLayout(PrintAttributes o, PrintAttributes n, CancellationSignal c, LayoutResultCallback cb, Bundle b) { inner.onLayout(o, n, c, cb, b); }
                                @Override
                                public void onWrite(PageRange[] pages, ParcelFileDescriptor dest, CancellationSignal c, WriteResultCallback cb) { inner.onWrite(pages, dest, c, cb); }
                                @Override
                                public void onFinish() {
                                    inner.onFinish();
                                    getActivity().runOnUiThread(() -> { if (printView == wv) release(); });
                                }
                            };
                            PrintAttributes attrs = new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                                .build();
                            pm.print(title, adapter, attrs);
                            call.resolve();
                        } catch (Exception e) {
                            release();
                            call.reject("تعذّر فتح نافذة الطباعة");
                        }
                    }
                });
                printView = wv;
                wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                release();
                call.reject("تعذّر فتح نافذة الطباعة");
            }
        });
    }

    private void release() {
        if (printView != null) {
            try { printView.destroy(); } catch (Exception ignored) { }
            printView = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        release();
        super.handleOnDestroy();
    }
}
