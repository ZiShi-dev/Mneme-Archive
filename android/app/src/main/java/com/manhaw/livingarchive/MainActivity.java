package com.manhaw.livingarchive;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean safeAreaListenerInstalled = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(MangalikHtmlFetcherPlugin.class);
        registerPlugin(ParadiseChapterFetcherPlugin.class);
        registerPlugin(AnimeEpisodePlayerPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        installSafeAreaInsetsListener();
    }

    private void installSafeAreaInsetsListener() {
        if (safeAreaListenerInstalled) return;

        View target = getBridge() != null ? getBridge().getWebView() : null;
        if (target == null) {
            target = findViewById(android.R.id.content);
        }
        if (target == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(target, (view, windowInsets) -> {
            Insets insets = resolveSafeAreaInsets(windowInsets);
            pushSafeAreaInsets(insets.top, insets.bottom, insets.left, insets.right);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(target);
        safeAreaListenerInstalled = true;
    }

    private static Insets resolveSafeAreaInsets(WindowInsetsCompat windowInsets) {
        int insetTypes = WindowInsetsCompat.Type.systemBars()
            | WindowInsetsCompat.Type.displayCutout()
            | WindowInsetsCompat.Type.navigationBars()
            | WindowInsetsCompat.Type.tappableElement()
            | WindowInsetsCompat.Type.mandatorySystemGestures();
        return windowInsets.getInsets(insetTypes);
    }

    @Override
    public void onResume() {
        super.onResume();
        installSafeAreaInsetsListener();
        View target = getBridge() != null ? getBridge().getWebView() : null;
        if (target == null) {
            target = findViewById(android.R.id.content);
        }
        if (target != null) ViewCompat.requestApplyInsets(target);
    }

    private void pushSafeAreaInsets(int top, int bottom, int left, int right) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String js = String.format(
            "document.documentElement.style.setProperty('--app-safe-area-top','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-bottom','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-left','%dpx');"
                + "document.documentElement.style.setProperty('--app-safe-area-right','%dpx');",
            top, bottom, left, right
        );
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
