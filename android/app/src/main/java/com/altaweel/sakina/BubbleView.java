package com.altaweel.sakina;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;

/**
 * الفقاعة العائمة فوق التطبيقات: دائرة بأيقونة سكينة وبجانبها عنوان التذكير.
 * تُسحب بالإصبع، وتفتح الصفحة المناسبة عند الضغط.
 * زر × ظاهر دائماً بجانب الدائرة: يغلق التذكير الحالي فقط دون فتح سكينة، ولا يؤثر على التذكيرات القادمة.
 * زر «تأجيل» مستقل: يعرض المدد التي اختارها المستخدم في الإعدادات، ويعيد إظهار التذكير نفسه بعدها.
 */
public final class BubbleView {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final long COLLAPSE_AFTER_MS = 12_000;
    private static final long DISMISS_AFTER_MS = 10 * 60_000;

    private static View current;
    private static Runnable collapseTask;
    private static Runnable dismissTask;

    private BubbleView() {}

    public static boolean canShow(Context ctx) {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx);
    }

    public static void show(Context ctx, final String title, final String body, final String route) {
        final Context app = ctx.getApplicationContext();
        MAIN.post(() -> showOnMain(app, title, body, route));
    }

    private static int dp(Context c, float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics());
    }

    private static void showOnMain(final Context app, String title, String body, final String route) {
        if (!canShow(app)) return;
        final WindowManager wm = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return;
        dismiss(wm);

        final LinearLayout root = new LinearLayout(app);
        root.setOrientation(LinearLayout.HORIZONTAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(dp(app, 4), dp(app, 4), dp(app, 4), dp(app, 4));

        // الدائرة: أيقونة التطبيق بإطار ذهبي
        final ImageView icon = new ImageView(app);
        icon.setImageResource(R.mipmap.ic_launcher_round);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(Color.parseColor("#1F5E43"));
        ring.setStroke(dp(app, 2), Color.parseColor("#D4A373"));
        icon.setBackground(ring);
        icon.setPadding(dp(app, 3), dp(app, 3), dp(app, 3), dp(app, 3));
        icon.setElevation(dp(app, 6));
        icon.setContentDescription(title);
        root.addView(icon, new LinearLayout.LayoutParams(dp(app, 58), dp(app, 58)));

        // زر الإغلاق: ظاهر دائماً حتى بعد طيّ البطاقة، ويغلق هذا التذكير فقط
        TextView close = new TextView(app);
        close.setText("✕");
        close.setTextColor(Color.parseColor("#1F5E43"));
        close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        close.setTypeface(Typeface.DEFAULT_BOLD);
        close.setGravity(Gravity.CENTER);
        close.setContentDescription("إغلاق التذكير");
        GradientDrawable cbg = new GradientDrawable();
        cbg.setShape(GradientDrawable.OVAL);
        cbg.setColor(Color.WHITE);
        cbg.setStroke(dp(app, 1), Color.parseColor("#D4A373"));
        close.setBackground(cbg);
        close.setElevation(dp(app, 7));
        close.setOnClickListener(v -> dismiss(wm));
        LinearLayout.LayoutParams cLp = new LinearLayout.LayoutParams(dp(app, 40), dp(app, 40));
        cLp.setMarginStart(dp(app, 4));
        root.addView(close, cLp);

        // البطاقة الصغيرة بجانب الدائرة
        final LinearLayout pill = new LinearLayout(app);
        pill.setOrientation(LinearLayout.HORIZONTAL);
        pill.setGravity(Gravity.CENTER_VERTICAL);
        pill.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(app, 22));
        bg.setColor(Color.parseColor("#F21F5E43"));
        pill.setBackground(bg);
        pill.setElevation(dp(app, 6));
        pill.setPadding(dp(app, 14), dp(app, 8), dp(app, 8), dp(app, 8));

        final LinearLayout texts = new LinearLayout(app);
        texts.setOrientation(LinearLayout.VERTICAL);
        TextView t1 = new TextView(app);
        t1.setText(title);
        t1.setTextColor(Color.WHITE);
        t1.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        t1.setTypeface(Typeface.DEFAULT_BOLD);
        t1.setMaxWidth(dp(app, 190));
        texts.addView(t1);
        if (body != null && !body.isEmpty()) {
            TextView t2 = new TextView(app);
            t2.setText(body);
            t2.setTextColor(Color.parseColor("#E6F3EE"));
            t2.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            t2.setMaxLines(2);
            t2.setMaxWidth(dp(app, 190));
            texts.addView(t2);
        }
        pill.addView(texts);

        // زر التأجيل: يستبدل محتوى البطاقة بالمدد المتاحة
        final LinearLayout snoozeRow = new LinearLayout(app);
        snoozeRow.setOrientation(LinearLayout.HORIZONTAL);
        snoozeRow.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        snoozeRow.setVisibility(View.GONE);
        final TextView snooze = chip(app, "تأجيل", false);
        snooze.setContentDescription("تأجيل التذكير");
        final String fTitle = title, fBody = body;
        snooze.setOnClickListener(v -> {
            MAIN.removeCallbacks(collapseTask);
            texts.setVisibility(View.GONE);
            snooze.setVisibility(View.GONE);
            // تُخفى الدائرة أثناء اختيار المدة حتى تتسع المدد الأربع لعرض الشاشات الصغيرة
            icon.setVisibility(View.GONE);
            snoozeRow.removeAllViews();
            final boolean arab = OverlayScheduler.arabDigits(app);
            for (final int m : OverlayScheduler.snoozeMinutes(app)) {
                TextView c = chip(app, label(m, arab), true);
                c.setOnClickListener(x -> {
                    OverlayScheduler.snooze(app, m, fTitle, fBody, route);
                    Toast.makeText(app, "سيظهر التذكير بعد " + label(m, arab), Toast.LENGTH_SHORT).show();
                    dismiss(wm);
                });
                snoozeRow.addView(c);
            }
            snoozeRow.setVisibility(View.VISIBLE);
        });
        LinearLayout.LayoutParams snLp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(app, 36));
        snLp.setMarginStart(dp(app, 8));
        pill.addView(snooze, snLp);
        pill.addView(snoozeRow);

        LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        pillLp.setMarginEnd(dp(app, 2));
        pillLp.setMarginStart(dp(app, 8));
        root.addView(pill, pillLp);

        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        final WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.RIGHT;
        lp.x = dp(app, 8);
        final int screenH = app.getResources().getDisplayMetrics().heightPixels;
        lp.y = (int) (screenH * 0.32f);

        View.OnTouchListener drag = new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;
            private boolean moved;
            private final int slop = ViewConfiguration.get(app).getScaledTouchSlop();

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX();
                        downY = e.getRawY();
                        startX = lp.x;
                        startY = lp.y;
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - downX;
                        float dy = e.getRawY() - downY;
                        if (!moved && Math.hypot(dx, dy) > slop) moved = true;
                        if (moved) {
                            lp.x = Math.max(0, startX - (int) dx);
                            lp.y = Math.max(0, startY + (int) dy);
                            try { wm.updateViewLayout(root, lp); } catch (Exception ignored) { }
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) {
                            open(app, route);
                            dismiss(wm);
                        } else if (e.getRawY() > screenH - dp(app, 110)) {
                            dismiss(wm);
                        }
                        return true;
                    default:
                        return false;
                }
            }
        };
        icon.setOnTouchListener(drag);
        texts.setOnTouchListener(drag);

        try {
            wm.addView(root, lp);
        } catch (Exception e) {
            return;
        }
        current = root;
        root.setScaleX(0.3f);
        root.setScaleY(0.3f);
        root.setAlpha(0f);
        root.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(260).start();

        // بعد ثوانٍ تُطوى البطاقة وتبقى الدائرة الصغيرة فقط
        // بعد ثوانٍ يُطوى النص ويبقى زر «تأجيل» ظاهراً مع الدائرة وزر الإغلاق
        collapseTask = () -> texts.animate().alpha(0f).setDuration(220).setListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator a) {
                texts.setVisibility(View.GONE);
                pill.setPadding(dp(app, 6), dp(app, 6), dp(app, 6), dp(app, 6));
                try { wm.updateViewLayout(root, lp); } catch (Exception ignored) { }
            }
        }).start();
        dismissTask = () -> dismiss(wm);
        MAIN.postDelayed(collapseTask, COLLAPSE_AFTER_MS);
        MAIN.postDelayed(dismissTask, DISMISS_AFTER_MS);
    }

    private static TextView chip(Context app, String text, boolean light) {
        TextView c = new TextView(app);
        c.setText(text);
        c.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        c.setTypeface(Typeface.DEFAULT_BOLD);
        c.setGravity(Gravity.CENTER);
        c.setTextColor(light ? Color.parseColor("#1F5E43") : Color.WHITE);
        c.setPadding(dp(app, 12), 0, dp(app, 12), 0);
        c.setMinHeight(dp(app, 36));
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(app, 18));
        if (light) g.setColor(Color.WHITE); else { g.setColor(Color.TRANSPARENT); g.setStroke(dp(app, 1), Color.parseColor("#D4A373")); }
        c.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(app, 36));
        lp.setMarginStart(dp(app, 4));
        c.setLayoutParams(lp);
        return c;
    }

    /** ٥ د، ١٥ د، ساعة، ساعتان… */
    static String label(int m, boolean arab) {
        if (m % 60 == 0) {
            int h = m / 60;
            return h == 1 ? "ساعة" : h == 2 ? "ساعتين" : digits(h, arab) + " ساعات";
        }
        return digits(m, arab) + " د";
    }

    /** الأرقام بالنظام الذي اختاره المستخدم في التطبيق */
    private static String digits(int n, boolean arab) {
        String s = String.valueOf(n);
        if (!arab) return s;
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) b.append((char) ('\u0660' + (s.charAt(i) - '0')));
        return b.toString();
    }

    private static void open(Context app, String route) {
        String path = route == null || route.isEmpty() ? "/home" : (route.startsWith("/") ? route : "/" + route);
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("sakina://open" + path));
        i.setPackage(app.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { app.startActivity(i); } catch (Exception ignored) { }
    }

    private static void dismiss(WindowManager wm) {
        if (collapseTask != null) MAIN.removeCallbacks(collapseTask);
        if (dismissTask != null) MAIN.removeCallbacks(dismissTask);
        collapseTask = null;
        dismissTask = null;
        if (current != null) {
            try { wm.removeView(current); } catch (Exception ignored) { }
            current = null;
        }
    }
}
