package com.manhaw.livingarchive;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.Locale;
import org.json.JSONObject;

@CapacitorPlugin(name = "MangalikHtmlFetcher")
public class MangalikHtmlFetcherPlugin extends Plugin {

    private static final String MANGALIK_HOST = "mangalik.net";
    private static final String HENTAIREAD_HOST = "hentairead.com";
    private static final String HENCOVER_HOST = "hencover.xyz";
    private static final String MANGALIK_WARMUP_URL = "https://mangalik.net/manga/";
    private static final String HENTAIREAD_WARMUP_URL = "https://hentairead.com/hentai/";
    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    private static final int POLL_INTERVAL_MS = 800;
    private static final int MAX_POLLS = 60;
    private static final String EXTRACT_JS =
        "(function(){try{"
            + "var html=document.documentElement?document.documentElement.outerHTML:'';"
            + "var body=document.body?document.body.innerHTML:'';"
            + "if(/Just a moment|cf-chl-|challenges\\.cloudflare\\.com/i.test(body)){return JSON.stringify({ready:false,blocked:true});}"
            + "if(!body||body.length<400){return JSON.stringify({ready:false});}"
            + "if(document.readyState!=='complete'){return JSON.stringify({ready:false});}"
            + "return JSON.stringify({ready:true,html:html});"
            + "}catch(error){return JSON.stringify({ready:false,error:String(error)});}})();";

    private enum Stage {
        WARMUP,
        TARGET,
        POLL,
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = () -> failActiveCall("انتهت مهلة تحميل الصفحة");
    private WebView activeWebView;
    private PluginCall activeCall;
    private int pollCount;
    private String pendingTargetUrl;
    private String pendingWarmupUrl = MANGALIK_WARMUP_URL;
    private Stage stage = Stage.WARMUP;

    @PluginMethod
    public void fetchHtml(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (!isAllowedUrl(url)) {
            call.reject("رابط المصدر غير مسموح");
            return;
        }
        if (activeCall != null) {
            call.reject("جاري تحميل صفحة أخرى");
            return;
        }

        activeCall = call;
        pollCount = 0;
        pendingTargetUrl = url;
        pendingWarmupUrl = warmupUrlFor(url);
        stage = Stage.WARMUP;
        getActivity().runOnUiThread(() -> startHtmlFetch(url));
    }

    @PluginMethod
    public void fetchImage(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (!isAllowedImageUrl(url)) {
            call.reject("رابط الصورة غير مسموح");
            return;
        }

        new Thread(
                () -> {
                    try {
                        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                        connection.setInstanceFollowRedirects(true);
                        connection.setConnectTimeout(25_000);
                        connection.setReadTimeout(25_000);
                        connection.setRequestProperty("User-Agent", USER_AGENT);
                        connection.setRequestProperty("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");
                        connection.setRequestProperty("Referer", refererFor(url));
                        String cookies = CookieManager.getInstance().getCookie(url);
                        if (cookies != null && !cookies.isEmpty()) {
                            connection.setRequestProperty("Cookie", cookies);
                        }

                        int status = connection.getResponseCode();
                        String contentType = connection.getContentType();
                        if (status < 200 || status >= 300 || contentType == null || !contentType.startsWith("image/")) {
                            call.reject("تعذر تحميل الصورة");
                            return;
                        }

                        byte[] bytes = readStream(connection.getInputStream());
                        JSObject result = new JSObject();
                        result.put("contentType", contentType.split(";")[0].trim());
                        result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                        call.resolve(result);
                    } catch (Exception error) {
                        call.reject("تعذر تحميل الصورة");
                    }
                }
            )
            .start();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void startHtmlFetch(String targetUrl) {
        cleanupWebView();
        WebView webView = new WebView(getContext());
        activeWebView = webView;
        webView.setVisibility(View.GONE);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(false);
        settings.setBlockNetworkImage(true);
        settings.setUserAgentString(USER_AGENT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        ViewGroup root = getActivity().findViewById(android.R.id.content);
        root.addView(webView, new FrameLayout.LayoutParams(1, 1));

        webView.setWebViewClient(
            new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return false;
                }

                @Override
                public void onPageFinished(WebView view, String loadedUrl) {
                    if (activeWebView != view || !targetUrl.equals(pendingTargetUrl)) {
                        return;
                    }
                    if (stage == Stage.WARMUP) {
                        stage = Stage.TARGET;
                        view.loadUrl(targetUrl);
                        return;
                    }
                    if (stage == Stage.TARGET && isSameUrl(loadedUrl, targetUrl)) {
                        stage = Stage.POLL;
                        handler.postDelayed(() -> pollHtml(view), POLL_INTERVAL_MS);
                    }
                }
            }
        );

        handler.postDelayed(timeoutRunnable, POLL_INTERVAL_MS * MAX_POLLS);
        webView.loadUrl(pendingWarmupUrl);
    }

    private void pollHtml(WebView webView) {
        if (activeWebView != webView || activeCall == null || stage != Stage.POLL) {
            return;
        }
        pollCount += 1;
        webView.evaluateJavascript(
            EXTRACT_JS,
            value -> {
                if (activeWebView != webView || activeCall == null || stage != Stage.POLL) {
                    return;
                }
                JSONObject payload = parseEvaluateResult(value);
                if (payload == null) {
                    scheduleNextPoll(webView);
                    return;
                }
                if (payload.optBoolean("blocked", false)) {
                    failActiveCall("حماية MangaLik تمنع الاتصال (Cloudflare)");
                    return;
                }
                if (!payload.optBoolean("ready", false)) {
                    scheduleNextPoll(webView);
                    return;
                }
                resolveActiveCall(payload.optString("html", ""));
            }
        );
    }

    private void scheduleNextPoll(WebView webView) {
        if (pollCount >= MAX_POLLS) {
            failActiveCall("تعذر تحميل محتوى الصفحة");
            return;
        }
        handler.postDelayed(() -> pollHtml(webView), POLL_INTERVAL_MS);
    }

    private void resolveActiveCall(String html) {
        PluginCall call = activeCall;
        if (call == null) {
            return;
        }
        if (html == null || html.trim().isEmpty()) {
            failActiveCall("تعذر تحميل محتوى الصفحة");
            return;
        }
        JSObject result = new JSObject();
        result.put("html", html);
        result.put("url", pendingTargetUrl);
        cleanupActiveRequest();
        call.resolve(result);
    }

    private void failActiveCall(String message) {
        PluginCall call = activeCall;
        cleanupActiveRequest();
        if (call != null) {
            call.reject(message);
        }
    }

    private void cleanupActiveRequest() {
        pendingTargetUrl = null;
        pendingWarmupUrl = MANGALIK_WARMUP_URL;
        activeCall = null;
        pollCount = 0;
        stage = Stage.WARMUP;
        handler.removeCallbacks(timeoutRunnable);
        cleanupWebView();
    }

    private void cleanupWebView() {
        if (activeWebView == null) {
            return;
        }
        WebView webView = activeWebView;
        activeWebView = null;
        webView.stopLoading();
        webView.setWebViewClient(null);
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent != null) {
            parent.removeView(webView);
        }
        webView.destroy();
    }

    private JSONObject parseEvaluateResult(String raw) {
        try {
            if (raw == null || "null".equals(raw)) {
                return null;
            }
            Object parsed = new org.json.JSONTokener(raw).nextValue();
            if (parsed instanceof String) {
                return new JSONObject((String) parsed);
            }
            if (parsed instanceof JSONObject) {
                return (JSONObject) parsed;
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    private boolean isSameUrl(String loadedUrl, String targetUrl) {
        try {
            URI loaded = new URI(loadedUrl);
            URI expected = new URI(targetUrl);
            String loadedPath = normalizePath(loaded.getPath());
            String expectedPath = normalizePath(expected.getPath());
            String loadedHost = normalizeHost(loaded.getHost());
            String expectedHost = normalizeHost(expected.getHost());
            if (!loadedHost.equals(expectedHost)) {
                return false;
            }
            if (loadedPath.equals(expectedPath)) {
                return true;
            }
            String loadedQuery = loaded.getQuery() == null ? "" : loaded.getQuery();
            String expectedQuery = expected.getQuery() == null ? "" : expected.getQuery();
            return loadedPath.equals(expectedPath) && loadedQuery.equals(expectedQuery);
        } catch (Exception error) {
            return targetUrl.equals(loadedUrl);
        }
    }

    private String normalizePath(String path) {
        if (path == null || path.isEmpty()) {
            return "/";
        }
        return path.replaceAll("/+$", "");
    }

    private String normalizeHost(String host) {
        if (host == null) {
            return "";
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("www.")) {
            return normalized.substring(4);
        }
        return normalized;
    }

    private String warmupUrlFor(String url) {
        try {
            String host = normalizeHost(new URI(url).getHost());
            if (HENTAIREAD_HOST.equals(host)) {
                return HENTAIREAD_WARMUP_URL;
            }
        } catch (Exception ignored) {
            return MANGALIK_WARMUP_URL;
        }
        return MANGALIK_WARMUP_URL;
    }

    private String refererFor(String url) {
        try {
            String host = normalizeHost(new URI(url).getHost());
            if (HENTAIREAD_HOST.equals(host) || HENCOVER_HOST.equals(host)) {
                return "https://hentairead.com/";
            }
        } catch (Exception ignored) {
            return "https://mangalik.net/";
        }
        return "https://mangalik.net/";
    }

    private boolean isAllowedUrl(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            String host = normalizeHost(uri.getHost());
            return MANGALIK_HOST.equals(host)
                || HENTAIREAD_HOST.equals(host);
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isAllowedImageUrl(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            String host = normalizeHost(uri.getHost());
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (HENCOVER_HOST.equals(host)) {
                return true;
            }
            if (!isAllowedUrl(url)) {
                return false;
            }
            if (HENTAIREAD_HOST.equals(host)) {
                return path.startsWith("/wp-content/uploads/") || path.startsWith("/hentai/");
            }
            return path.startsWith("/manga/") || path.startsWith("/wp-content/uploads/");
        } catch (Exception error) {
            return false;
        }
    }

    private byte[] readStream(InputStream inputStream) throws Exception {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int read;
        while ((read = inputStream.read(chunk)) != -1) {
            buffer.write(chunk, 0, read);
        }
        return buffer.toByteArray();
    }
}
