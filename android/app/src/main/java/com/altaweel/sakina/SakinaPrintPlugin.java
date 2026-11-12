package com.altaweel.sakina;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
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
    // مرجع حتى لا يُحذف العرض قبل انتهاء الطباعة
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String title = call.getString("title", "سكينة");
        getActivity().runOnUiThread(() -> {
            try {
                WebView wv = new WebView(getActivity());
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        try {
                            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(title);
                            PrintAttributes attrs = new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                                .build();
                            pm.print(title, adapter, attrs);
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("تعذّر فتح نافذة الطباعة");
                        }
                    }
                });
                wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                printView = wv;
            } catch (Exception e) {
                call.reject("تعذّر فتح نافذة الطباعة");
            }
        });
    }
}
