package com.manhaw.livingarchive;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AnimeEpisodePlayer")
public class AnimeEpisodePlayerPlugin extends Plugin {

    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    private static final Pattern EPISODE_PATH = Pattern.compile("/episode/", Pattern.CASE_INSENSITIVE);
    private static final Pattern ALLOWED_HOST =
        Pattern.compile(
            "(^|\\.)((4h\\.b9p2m6c\\.shop)|([a-z0-9-]+\\.b9p2m6c\\.shop)|([a-z0-9-]+\\.anime4up\\.rest)|"
                + "(voe\\.sx)|([a-z0-9-]+\\.mp4upload\\.com)|([a-z0-9-]+\\.share4max\\.(com|org))|"
                + "(vkvideo\\.ru)|([a-z0-9-]+\\.playmogo\\.com)|([a-z0-9-]+\\.rubyvidhub\\.com)|"
                + "([a-z0-9-]+\\.uqload\\.(com|to|cx))|([a-z0-9-]+\\.dood\\.(com|watch))|"
                + "([a-z0-9-]+\\.streamruby\\.com)|(videa\\.hu))$",
            Pattern.CASE_INSENSITIVE
        );

    private FrameLayout overlay;
    private WebView playerWebView;

    @PluginMethod
    public void loadUrl(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (!isAllowedEpisodeUrl(url)) {
            call.reject("رابط الحلقة غير مسموح");
            return;
        }
        getActivity()
            .runOnUiThread(
                () -> {
                    if (playerWebView == null) {
                        showPlayer(url, "");
                    } else {
                        playerWebView.loadUrl(url);
                    }
                    call.resolve();
                }
            );
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url", "").trim();
        String title = call.getString("title", "").trim();
        if (!isAllowedEpisodeUrl(url)) {
            call.reject("رابط الحلقة غير مسموح");
            return;
        }

        getActivity()
            .runOnUiThread(
                () -> {
                    showPlayer(url, title);
                    call.resolve();
                }
            );
    }

    @PluginMethod
    public void close(PluginCall call) {
        getActivity()
            .runOnUiThread(
                () -> {
                    hidePlayer(false);
                    call.resolve();
                }
            );
    }

    @PluginMethod
    public void isOpen(PluginCall call) {
        JSObject result = new JSObject();
        result.put("open", overlay != null);
        call.resolve(result);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showPlayer(String url, String title) {
        hidePlayer(false);

        FrameLayout container = new FrameLayout(getContext());
        container.setLayoutParams(
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        container.setBackgroundColor(Color.parseColor("#090A12"));
        container.setClickable(true);
        container.setFocusable(true);

        LinearLayout topBar = new LinearLayout(getContext());
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        topBar.setBackgroundColor(Color.parseColor("#12141E"));
        topBar.setPadding(dp(12), dp(10), dp(12), dp(10));
        topBar.setLayoutParams(
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP
            )
        );

        TextView titleView = new TextView(getContext());
        titleView.setTextColor(Color.parseColor("#F4F1EA"));
        titleView.setTextSize(13f);
        titleView.setPadding(dp(4), dp(8), dp(8), dp(8));
        titleView.setSingleLine(true);
        titleView.setText(title.isEmpty() ? "مشغل الحلقة" : title);
        topBar.addView(titleView, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView closeButton = new TextView(getContext());
        closeButton.setText("إغلاق");
        closeButton.setTextColor(Color.parseColor("#F4F1EA"));
        closeButton.setTextSize(14f);
        closeButton.setPadding(dp(14), dp(8), dp(14), dp(8));
        closeButton.setBackgroundColor(Color.parseColor("#303342"));
        closeButton.setOnClickListener(view -> hidePlayer(true));
        topBar.addView(closeButton);

        WebView webView = new WebView(getContext());
        playerWebView = webView;
        FrameLayout.LayoutParams webParams =
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            );
        webParams.topMargin = dp(52);
        webView.setLayoutParams(webParams);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(USER_AGENT);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(
            new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String target = request.getUrl().toString();
                    return !isAllowedNavigation(target);
                }
            }
        );

        webView.setWebChromeClient(
            new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                    return false;
                }
            }
        );

        container.addView(webView);
        container.addView(topBar);

        ViewGroup root = getActivity().findViewById(android.R.id.content);
        root.addView(
            container,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        overlay = container;
        webView.loadUrl(url);
    }

    private void hidePlayer(boolean notifyDismissed) {
        if (playerWebView != null) {
            playerWebView.stopLoading();
            playerWebView.setWebViewClient(null);
            playerWebView.destroy();
            playerWebView = null;
        }
        if (overlay != null) {
            ViewGroup parent = (ViewGroup) overlay.getParent();
            if (parent != null) {
                parent.removeView(overlay);
            }
            overlay = null;
        }
        if (notifyDismissed) {
            notifyListeners("dismissed", new JSObject());
        }
    }

    private int dp(int value) {
        float density = getContext().getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    private boolean isAllowedEpisodeUrl(String url) {
        if (!url.startsWith("https://")) {
            return false;
        }
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            if (host == null || !ALLOWED_HOST.matcher(host).matches()) {
                return false;
            }
            String path = uri.getPath() == null ? "" : uri.getPath();
            return EPISODE_PATH.matcher(path).find() || isAllowedEmbedPath(path);
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isAllowedEmbedPath(String path) {
        String normalized = path.toLowerCase(Locale.ROOT);
        return normalized.contains("/embed")
            || normalized.contains("/iframe")
            || normalized.contains("/e/")
            || normalized.contains("/video_ext")
            || normalized.contains("/player");
    }

    private boolean isAllowedNavigation(String url) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) {
            return false;
        }
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            return host != null && ALLOWED_HOST.matcher(host).matches();
        } catch (Exception error) {
            return false;
        }
    }
}
