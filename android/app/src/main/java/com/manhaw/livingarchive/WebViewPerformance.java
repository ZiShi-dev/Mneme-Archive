package com.manhaw.livingarchive;

import android.os.Build;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Réglages WebView pour une lecture fluide (GPU, cache HTTP, priorité renderer). */
final class WebViewPerformance {
    private WebViewPerformance() {}

    static void applyMain(WebView webView) {
        applyMedia(webView);
        if (webView == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
    }

    static void applyMedia(WebView webView) {
        if (webView == null) return;
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }
    }
}
