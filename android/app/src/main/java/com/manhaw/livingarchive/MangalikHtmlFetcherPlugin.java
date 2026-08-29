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
import java.util.ArrayDeque;
import java.util.Locale;
import org.json.JSONObject;

@CapacitorPlugin(name = "MangalikHtmlFetcher")
public class MangalikHtmlFetcherPlugin extends Plugin {

    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    private static final int POLL_INTERVAL_MS = 800;
    private static final int MAX_POLLS = 90;
    private static final int MAX_FETCH_RETRIES = 1;
    private static final String EXTRACT_JS =
        "(function(){try{"
            + "var html=document.documentElement?document.documentElement.outerHTML:'';"
            + "var body=document.body?document.body.innerHTML:'';"
            + "var hasCatalog=/wp-manga|page-item-detail|item[^\"']*wp-manga|dooplay/i.test(body);"
            + "if(hasCatalog&&body.length>1200){return JSON.stringify({ready:true,html:html});}"
            + "if(/Just a moment|cf-chl-|challenges\\.cloudflare\\.com/i.test(body)){return JSON.stringify({ready:false,blocked:true});}"
            + "if(!body||body.length<400){return JSON.stringify({ready:false});}"
            + "if(document.readyState!=='complete'){return JSON.stringify({ready:false});}"
            + "return JSON.stringify({ready:true,html:html});"
            + "}catch(error){return JSON.stringify({ready:false,error:String(error)});}})();";

    private static final class SourceHost {
        final String host;
        final String warmupUrl;
        final String referer;

        SourceHost(String host, String warmupUrl, String referer) {
            this.host = host;
            this.warmupUrl = warmupUrl;
            this.referer = referer;
        }
    }

    private static final SourceHost[] SOURCE_HOSTS = {
        new SourceHost("mangalik.net", "https://mangalik.net/manga/", "https://mangalik.net/"),
        new SourceHost("hentairead.com", "https://hentairead.com/hentai/", "https://hentairead.com/"),
        new SourceHost("azorafly.com", "https://azorafly.com/", "https://azorafly.com/"),
        new SourceHost("galaxynovels.com", "https://galaxynovels.com/", "https://galaxynovels.com/"),
        new SourceHost("wtr-lab.com", "https://wtr-lab.com/en/novel-list", "https://wtr-lab.com/"),
    };

    private static final String HENCOVER_HOST = "hencover.xyz";
    private static final String AZORA_STORAGE_HOST = "storage.azorafly.com";
    private static final String MANGALIK_APEX = "mangalik.net";

    private enum Stage {
        WARMUP,
        TARGET,
        POLL,
    }

    private static final class PendingHtmlRequest {
        final PluginCall call;
        final String url;

        PendingHtmlRequest(PluginCall call, String url) {
            this.call = call;
            this.url = url;
        }
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private enum FetchMode {
        HTML,
        WTR_READER,
    }

    private static final class PendingWtrlabRequest {
        final PluginCall call;
        final int rawId;
        final int chapterNo;
        final String slug;
        final String translate;

        PendingWtrlabRequest(PluginCall call, int rawId, int chapterNo, String slug, String translate) {
            this.call = call;
            this.rawId = rawId;
            this.chapterNo = chapterNo;
            this.slug = slug;
            this.translate = translate;
        }
    }

    private final ArrayDeque<PendingWtrlabRequest> pendingWtrlabRequests = new ArrayDeque<>();
    private final ArrayDeque<PendingHtmlRequest> pendingHtmlRequests = new ArrayDeque<>();
    private FetchMode fetchMode = FetchMode.HTML;
    private String pendingWtrlabReaderJs = "";
    private final Runnable timeoutRunnable = () -> failActiveCall("انتهت مهلة تحميل الصفحة");
    private WebView activeWebView;
    private PluginCall activeCall;
    private int pollCount;
    private String pendingTargetUrl;
    private String pendingWarmupUrl = SOURCE_HOSTS[0].warmupUrl;
    private int activeFetchRetries = 0;
    private Stage stage = Stage.WARMUP;

    @PluginMethod
    public void fetchHtml(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (!isAllowedUrl(url)) {
            call.reject("رابط المصدر غير مسموح");
            return;
        }

        if (activeCall != null) {
            call.setKeepAlive(true);
            pendingHtmlRequests.addLast(new PendingHtmlRequest(call, url));
            return;
        }

        beginHtmlFetch(call, url);
    }

    @PluginMethod
    public void fetchWtrlabChapter(PluginCall call) {
        int rawId = call.getInt("rawId", 0);
        int chapterNo = call.getInt("chapterNo", 0);
        String slug = call.getString("slug", "").trim();
        String translate = call.getString("translate", "web").trim();
        if (rawId <= 0 || chapterNo <= 0 || slug.isEmpty()) {
            call.reject("فصل WTR-LAB غير صالح");
            return;
        }
        if (!"web".equals(translate) && !"ai".equals(translate)) {
            translate = "web";
        }

        if (activeCall != null) {
            call.setKeepAlive(true);
            pendingWtrlabRequests.addLast(new PendingWtrlabRequest(call, rawId, chapterNo, slug, translate));
            return;
        }

        beginWtrlabFetch(call, rawId, chapterNo, slug, translate);
    }

    private void beginWtrlabFetch(PluginCall call, int rawId, int chapterNo, String slug, String translate) {
        activeCall = call;
        pollCount = 0;
        fetchMode = FetchMode.WTR_READER;
        pendingWtrlabReaderJs = buildWtrlabReaderJs(rawId, chapterNo, translate);
        pendingTargetUrl = "https://wtr-lab.com/en/novel/" + rawId + "/" + slug + "/" + chapterNo;
        pendingWarmupUrl = "https://wtr-lab.com/en/novel-list";
        stage = Stage.WARMUP;
        getActivity().runOnUiThread(() -> startHtmlFetch(pendingTargetUrl));
    }

    private String buildWtrlabReaderJs(int rawId, int chapterNo, String translate) {
        return "(function(){try{return fetch('/api/reader/get',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({translate:'"
            + translate
            + "',language:'en',raw_id:"
            + rawId
            + ",chapter_no:"
            + chapterNo
            + ",retry:false,force_retry:false})}).then(function(response){return response.json();}).then(function(payload){if(payload&&payload.success){return JSON.stringify({ready:true,payload:payload});}return JSON.stringify({ready:false,blocked:/turnstile|logged in/i.test(String(payload.error||payload.message||'')),error:payload.error||payload.message||'reader_failed'});}).catch(function(error){return JSON.stringify({ready:false,error:String(error)});});}catch(error){return JSON.stringify({ready:false,error:String(error)});}})();";
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

    private void beginHtmlFetch(PluginCall call, String url) {
        activeCall = call;
        pollCount = 0;
        fetchMode = FetchMode.HTML;
        pendingTargetUrl = url;
        pendingWarmupUrl = warmupUrlFor(url);
        stage = Stage.WARMUP;
        getActivity().runOnUiThread(() -> startHtmlFetch(url));
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
        final String script = fetchMode == FetchMode.WTR_READER ? pendingWtrlabReaderJs : EXTRACT_JS;
        webView.evaluateJavascript(
            script,
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
                    scheduleNextPoll(webView);
                    return;
                }
                if (!payload.optBoolean("ready", false)) {
                    scheduleNextPoll(webView);
                    return;
                }
                if (fetchMode == FetchMode.WTR_READER) {
                    resolveWtrlabCall(payload.optJSONObject("payload"));
                    return;
                }
                resolveActiveCall(payload.optString("html", ""));
            }
        );
    }

    private void scheduleNextPoll(WebView webView) {
        if (pollCount >= MAX_POLLS) {
            failActiveCall("حماية الموقع تمنع الاتصال (Cloudflare)");
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
        startNextQueuedHtmlFetch();
    }

    private void resolveWtrlabCall(JSONObject payload) {
        PluginCall call = activeCall;
        if (call == null) {
            return;
        }
        if (payload == null) {
            failActiveCall("تعذر تحميل فصل WTR-LAB");
            return;
        }
        JSObject result = new JSObject();
        result.put("payload", payload.toString());
        cleanupActiveRequest();
        call.resolve(result);
        startNextQueuedHtmlFetch();
    }

    private void failActiveCall(String message) {
        PluginCall call = activeCall;
        String retryUrl = pendingTargetUrl;
        int retries = activeFetchRetries;
        boolean canRetry = retries < MAX_FETCH_RETRIES
            && retryUrl != null
            && !retryUrl.isEmpty()
            && (message.contains("Cloudflare")
                || message.contains("مهلة")
                || message.contains("تعذر"));
        cleanupActiveRequest();
        if (canRetry && call != null) {
            activeFetchRetries = retries + 1;
            beginHtmlFetch(call, retryUrl);
            return;
        }
        if (call != null) {
            call.reject(message);
        }
        startNextQueuedHtmlFetch();
    }

    private void startNextQueuedHtmlFetch() {
        PendingWtrlabRequest wtrlabNext = pendingWtrlabRequests.pollFirst();
        if (wtrlabNext != null) {
            beginWtrlabFetch(wtrlabNext.call, wtrlabNext.rawId, wtrlabNext.chapterNo, wtrlabNext.slug, wtrlabNext.translate);
            return;
        }
        PendingHtmlRequest next = pendingHtmlRequests.pollFirst();
        if (next == null) {
            return;
        }
        beginHtmlFetch(next.call, next.url);
    }

    private void cleanupActiveRequest() {
        pendingTargetUrl = null;
        pendingWarmupUrl = SOURCE_HOSTS[0].warmupUrl;
        pendingWtrlabReaderJs = "";
        fetchMode = FetchMode.HTML;
        activeCall = null;
        pollCount = 0;
        activeFetchRetries = 0;
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

    private boolean isMangalikHost(String host) {
        return MANGALIK_APEX.equals(host) || host.endsWith("." + MANGALIK_APEX);
    }

    private SourceHost sourceHostFor(String url) {
        try {
            String host = normalizeHost(new URI(url).getHost());
            for (SourceHost sourceHost : SOURCE_HOSTS) {
                if (sourceHost.host.equals(host)) {
                    return sourceHost;
                }
            }
        } catch (Exception ignored) {
            return SOURCE_HOSTS[0];
        }
        return SOURCE_HOSTS[0];
    }

    private String warmupUrlFor(String url) {
        return sourceHostFor(url).warmupUrl;
    }

    private String refererFor(String url) {
        try {
            String host = normalizeHost(new URI(url).getHost());
            if (HENCOVER_HOST.equals(host)) {
                return "https://hentairead.com/";
            }
            if (isMangalikHost(host)) {
                return "https://mangalik.net/";
            }
            if (AZORA_STORAGE_HOST.equals(host)) {
                return "https://azorafly.com/";
            }
            return sourceHostFor(url).referer;
        } catch (Exception ignored) {
            return SOURCE_HOSTS[0].referer;
        }
    }

    private boolean isAllowedUrl(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            String host = normalizeHost(uri.getHost());
            for (SourceHost sourceHost : SOURCE_HOSTS) {
                if (sourceHost.host.equals(host)) {
                    return true;
                }
            }
            return false;
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
            if (HENCOVER_HOST.equals(host) || AZORA_STORAGE_HOST.equals(host)) {
                return true;
            }
            if (isMangalikHost(host)) {
                return path.startsWith("/manga/") || path.startsWith("/wp-content/uploads/");
            }
            if (!isAllowedUrl(url)) {
                return false;
            }
            if ("hentairead.com".equals(host)) {
                return path.startsWith("/wp-content/uploads/") || path.startsWith("/hentai/");
            }
            if ("hencover.xyz".equals(host)) {
                return true;
            }
            if ("azorafly.com".equals(host)) {
                return path.startsWith("/upload/") || path.startsWith("/public/upload/");
            }
            if ("galaxynovels.com".equals(host)) {
                return path.startsWith("/wp-content/uploads/");
            }
            if ("wtr-lab.com".equals(host)) {
                return path.startsWith("/cdn/") || path.startsWith("/assets/");
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
