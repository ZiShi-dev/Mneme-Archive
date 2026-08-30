package com.manhaw.livingarchive;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private View attachedInsetView = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(MangalikHtmlFetcherPlugin.class);
        registerPlugin(ParadiseChapterFetcherPlugin.class);
        registerPlugin(AnimeEpisodePlayerPlugin.class);
        super.onCreate(savedInstanceState);
        configureEdgeToEdgeWindow();
        scheduleSafeAreaInsetUpdates();
    }

    private void scheduleSafeAreaInsetUpdates() {
        installSafeAreaInsetsListener();
        View decorView = getWindow().getDecorView();
        decorView.post(this::installSafeAreaInsetsListener);
        decorView.postDelayed(this::installSafeAreaInsetsListener, 150);
        decorView.postDelayed(this::installSafeAreaInsetsListener, 600);
    }

    private void configureEdgeToEdgeWindow() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.parseColor("#090A12"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams layoutParams = window.getAttributes();
            layoutParams.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(layoutParams);
        }
    }

    private void installSafeAreaInsetsListener() {
        View webView = getBridge() != null ? getBridge().getWebView() : null;
        View target = webView != null ? webView : getWindow().getDecorView();
        if (target == null) return;

        if (target == attachedInsetView) {
            ViewCompat.requestApplyInsets(target);
            return;
        }

        attachedInsetView = target;
        ViewCompat.setOnApplyWindowInsetsListener(target, (view, windowInsets) -> {
            pushSafeAreaInsets(windowInsets);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(target);
    }

    private static int maxInset(int... values) {
        int max = 0;
        for (int value : values) {
            max = Math.max(max, value);
        }
        return max;
    }

    private static Insets resolveSafeAreaInsets(WindowInsetsCompat windowInsets) {
        int top = maxInset(
            windowInsets.getInsets(WindowInsetsCompat.Type.statusBars()).top,
            windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout()).top,
            windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()).top
        );
        int navBottom = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
        int gestureBottom = windowInsets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures()).bottom;
        int bottom = navBottom > 0 ? navBottom : gestureBottom;
        int left = maxInset(
            windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout()).left,
            windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()).left,
            windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).left
        );
        int right = maxInset(
            windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout()).right,
            windowInsets.getInsets(WindowInsetsCompat.Type.systemBars()).right,
            windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).right
        );
        return Insets.of(left, top, right, bottom);
    }

    @Override
    public void onResume() {
        super.onResume();
        scheduleSafeAreaInsetUpdates();
    }

    private void pushSafeAreaInsets(WindowInsetsCompat windowInsets) {
        Insets insets = resolveSafeAreaInsets(windowInsets);
        int navBarBottom = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
        String navMode = navBarBottom > 0 ? "buttons" : "gesture";
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String js = String.format(
            "document.documentElement.style.setProperty('--app-safe-area-top','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-bottom','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-left','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-right','%dpx');"
                + "document.documentElement.dataset.navMode='%s';",
            insets.top, insets.bottom, insets.left, insets.right, navMode
        );
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
