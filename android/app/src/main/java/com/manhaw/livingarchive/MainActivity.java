package com.manhaw.livingarchive;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ParadiseChapterFetcherPlugin.class);
        registerPlugin(MangalikHtmlFetcherPlugin.class);
        registerPlugin(AnimeEpisodePlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyEmbedPopupGuards();
    }

    private void applyEmbedPopupGuards() {
        Bridge bridge = getBridge();
        if (bridge == null) {
            return;
        }
        WebView webView = bridge.getWebView();
        if (webView == null) {
            return;
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);

        if (!(webView.getWebChromeClient() instanceof PopupBlockingWebChromeClient)) {
            webView.setWebChromeClient(new PopupBlockingWebChromeClient(bridge));
        }
    }
}
