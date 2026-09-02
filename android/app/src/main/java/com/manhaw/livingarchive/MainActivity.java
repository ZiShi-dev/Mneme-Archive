package com.manhaw.livingarchive;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private View attachedInsetView = null;
    private boolean embedGuardsInstalled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(MangalikHtmlFetcherPlugin.class);
        registerPlugin(ParadiseChapterFetcherPlugin.class);
        registerPlugin(AnimeEpisodePlayerPlugin.class);
        super.onCreate(savedInstanceState);
        configureEdgeToEdgeWindow();
        configureWebViewPerformance();
        scheduleSafeAreaInsetUpdates();
        getWindow().getDecorView().post(this::installEmbedNavigationGuards);
    }

    private void configureWebViewPerformance() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebViewPerformance.applyMain(getBridge().getWebView());
    }

    private void installEmbedNavigationGuards() {
        if (embedGuardsInstalled) return;
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            WebView webView = getBridge().getWebView();
            WebViewPerformance.applyMain(webView);
            webView.setWebViewClient(new AdBlockingBridgeWebViewClient(getBridge()));
            webView.setWebChromeClient(new PopupBlockingWebChromeClient(getBridge()));
            embedGuardsInstalled = true;
        } catch (RuntimeException ignored) {
            // Ne jamais faire planter le démarrage si le WebView n'est pas prêt.
        }
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
        // Ne pas utiliser mandatorySystemGestures : trop haut en mode glisser.
        // navigationBars suffit (barre à boutons ou fine pastille home).
        int bottom = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
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

    /** Boutons système = barre de navigation ≥ 48dp ; sinon gestes. */
    private static String resolveNavMode(WindowInsetsCompat windowInsets) {
        int navBottom = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
        if (navBottom >= 48) {
            return "buttons";
        }
        return "gesture";
    }

    @Override
    public void onResume() {
        super.onResume();
        scheduleSafeAreaInsetUpdates();
        if (!embedGuardsInstalled) {
            getWindow().getDecorView().post(this::installEmbedNavigationGuards);
        }
    }

    private void pushSafeAreaInsets(WindowInsetsCompat windowInsets) {
        Insets insets = resolveSafeAreaInsets(windowInsets);
        String navMode = resolveNavMode(windowInsets);
        boolean systemBarsVisible = windowInsets.isVisible(WindowInsetsCompat.Type.statusBars())
            || windowInsets.isVisible(WindowInsetsCompat.Type.navigationBars());
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String js = String.format(
            "document.documentElement.style.setProperty('--app-safe-area-top','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-bottom','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-left','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-right','%dpx');"
                + "document.documentElement.dataset.navMode='%s';"
                + "document.documentElement.dataset.systemBarsVisible='%s';",
            insets.top, insets.bottom, insets.left, insets.right, navMode,
            systemBarsVisible ? "true" : "false"
        );
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
