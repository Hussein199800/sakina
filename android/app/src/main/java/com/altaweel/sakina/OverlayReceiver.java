package com.altaweel.sakina;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** يُظهر الفقاعة عند حلول الموعد، ويعيد الجدولة بعد إعادة تشغيل الهاتف أو تحديث التطبيق */
public class OverlayReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (OverlayScheduler.ACTION_SHOW.equals(action)) {
            BubbleView.show(context,
                intent.getStringExtra(OverlayScheduler.EXTRA_TITLE),
                intent.getStringExtra(OverlayScheduler.EXTRA_BODY),
                intent.getStringExtra(OverlayScheduler.EXTRA_ROUTE));
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            OverlayScheduler.restore(context);
        }
    }
}
