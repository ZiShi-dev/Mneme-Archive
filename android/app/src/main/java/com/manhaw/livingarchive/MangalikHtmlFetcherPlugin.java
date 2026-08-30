package com.manhaw.livingarchive;

import android.annotation.SuppressLint;
import android.os.Build;
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
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONObject;

@CapacitorPlugin(name = "MangalikHtmlFetcher")
public class MangalikHtmlFetcherPlugin extends Plugin {

    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36";
    private static final int POLL_INTERVAL_MS = 900;
    private static final int MAX_POLLS = 120;
    private static final int MAX_BLOCKED_POLLS = 50;
    private static final int OVERALL_TIMEOUT_MS = 5 * 60_000;
    private static final int WEBVIEW_WIDTH_PX = 393;
    private static final int WEBVIEW_HEIGHT_PX = 852;
    private static final long HOST_SESSION_TTL_MS = 15 * 60_000;
    private static final Map<String, Long> hostSessionAt = new ConcurrentHashMap<>();
    private static final String EXTRACT_JS =
        "(function(){try{"
            + "var html=document.documentElement?document.documentElement.outerHTML:'';"
            + "var body=document.body?document.body.innerHTML:'';"
            + "var cfHard=/Just a moment|Attention Required!?|Checking your browser/i;"
            + "var cfSoft=/cf-chl-|cdn-cgi\\/challenge-platform|cf-browser-verification|cf-turnstile|__cf_chl_opt|challenges\\.cloudflare\\.com/i;"
            + "var hasContent=/novel-item|novel-list|page-item-detail|wp-manga|manga-item|bg-card|data-wor-library|wor-library|wor-single-novel|wor-reader|epcontent|reading-content|text-chapter|ts-post-image|<article\\b/i.test(body);"
            + "if(cfHard.test(html)||cfHard.test(body)||((cfSoft.test(html)||cfSoft.test(body))&&!hasContent)){return JSON.stringify({ready:false,blocked:true});}"
            + "var hasCatalog=/wp-manga|page-item-detail|item[^\"']*wp-manga|manga-item|dooplay/i.test(body);"
            + "var hasAzora=/storage\\.azorafly\\.com|href=\\\"\\/series\\/|itemprop=\\\"genre\\\"|bg-card/i.test(body);"
            + "var hasGalaxy=/data-wor-library-novel-id|wor-cover-img|wor-library|wor-single-novel|wor-reader|wor-chapter/i.test(body);"
            + "var hasParadise=/ts-post-image|<article\\b|epcl-|eplister/i.test(body);"
            + "var hasNovelPhoenix=/novel-item|novel-title|chapter-content|chapter-body/i.test(body);"
            + "var hasChapter=/reading-content|wp-manga-chapter|manga-reading|chapter-image|epcontent|text-chapter/i.test(body);"
            + "if((hasCatalog||hasAzora||hasGalaxy||hasParadise||hasNovelPhoenix||hasChapter)&&body.length>800){return JSON.stringify({ready:true,html:html});}"
            + "if(!body||body.length<400){return JSON.stringify({ready:false});}"
            + "if(document.readyState!=='complete'){return JSON.stringify({ready:false});}"
            + "return JSON.stringify({ready:false});"
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
        new SourceHost("azorafly.com", "https://azorafly.com/", "https://azorafly.com/"),
        new SourceHost("galaxynovels.com", "https://galaxynovels.com/library/", "https://galaxynovels.com/"),
        new SourceHost("wtr-lab.com", "https://wtr-lab.com/en/novel-list", "https://wtr-lab.com/"),
        new SourceHost("arabshentai.com", "https://arabshentai.com/manga/", "https://arabshentai.com/"),
        new SourceHost("hentairead.com", "https://hentairead.com/hentai/", "https://hentairead.com/"),
        new SourceHost("mangaforfree.com", "https://mangaforfree.com/manga/", "https://mangaforfree.com/"),
        new SourceHost("novelsparadise.site", "https://novelsparadise.site/series/", "https://novelsparadise.site/"),
        new SourceHost("kolnovel.com", "https://kolnovel.com/series/", "https://kolnovel.com/"),
        new SourceHost("novelphoenix.com", "https://novelphoenix.com/", "https://novelphoenix.com/"),
    };

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
    private int blockedPollCount;
    private String pendingTargetUrl;
    private String pendingWarmupUrl = SOURCE_HOSTS[0].warmupUrl;
    private Stage stage = Stage.WARMUP;

    @PluginMethod
    public void cancelPending(PluginCall call) {
        pendingHtmlRequests.clear();
        PluginCall current = activeCall;
        if (current != null && fetchMode == FetchMode.HTML) {
            activeCall = null;
            cleanupActiveRequest();
            current.reject("cancelled");
        }
        call.resolve();
    }

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
        blockedPollCount = 0;
        fetchMode = FetchMode.WTR_READER;
        pendingWtrlabReaderJs = buildWtrlabReaderJs(rawId, chapterNo, translate);
        pendingTargetUrl = "https://wtr-lab.com/en/novel/" + rawId + "/" + slug + "/" + chapterNo;
        pendingWarmupUrl = "https://wtr-lab.com/en/novel-list";
        stage = Stage.WARMUP;
        handler.postDelayed(timeoutRunnable, OVERALL_TIMEOUT_MS);
        getActivity().runOnUiThread(() -> startWtrlabWebViewFetch(pendingTargetUrl));
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
        blockedPollCount = 0;
        fetchMode = FetchMode.HTML;
        pendingTargetUrl = url;
        handler.postDelayed(timeoutRunnable, OVERALL_TIMEOUT_MS);
        fetchHtmlDirectOnly();
    }

    private void fetchHtmlDirectOnly() {
        final String targetUrl = pendingTargetUrl;
        if (targetUrl == null || targetUrl.isEmpty() || activeCall == null) {
            return;
        }

        new Thread(
                () -> {
                    String html = fetchHtmlDirect(targetUrl);
                    boolean valid = looksLikeSourceHtml(html);
                    boolean blocked = !valid && isCloudflareChallengeHtml(html);
                    getActivity()
                        .runOnUiThread(
                            () -> {
                                if (activeCall == null || fetchMode != FetchMode.HTML || !targetUrl.equals(pendingTargetUrl)) {
                                    return;
                                }
                                if (valid) {
                                    resolveActiveCall(html);
                                    return;
                                }
                                if (!blocked && html != null && !html.isEmpty()) {
                                    resolveActiveCall(html);
                                    return;
                                }
                                failActiveCall("حماية الموقع تمنع الاتصال (Cloudflare)");
                            }
                        );
                }
            )
            .start();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView webView) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        settings.setUserAgentString(USER_AGENT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
    }

    private void attachHiddenWebView(WebView webView) {
        webView.setAlpha(0.01f);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        ViewGroup root = getActivity().findViewById(android.R.id.content);
        root.addView(
            webView,
            new FrameLayout.LayoutParams(WEBVIEW_WIDTH_PX, WEBVIEW_HEIGHT_PX)
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void startWtrlabWebViewFetch(String targetUrl) {
        cleanupWebView();
        WebView webView = new WebView(getContext());
        activeWebView = webView;
        configureWebView(webView);
        attachHiddenWebView(webView);

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
                        if (isSameUrl(pendingWarmupUrl, pendingTargetUrl)) {
                            stage = Stage.POLL;
                            handler.postDelayed(() -> pollHtml(view), POLL_INTERVAL_MS);
                        } else {
                            stage = Stage.TARGET;
                            view.loadUrl(targetUrl);
                        }
                        return;
                    }
                    if (stage == Stage.TARGET && isSameUrl(loadedUrl, targetUrl)) {
                        stage = Stage.POLL;
                        handler.postDelayed(() -> pollHtml(view), POLL_INTERVAL_MS);
                    }
                }
            }
        );

        webView.loadUrl(pendingWarmupUrl);
    }

    private void pollHtml(WebView webView) {
        if (activeWebView != webView || activeCall == null || stage != Stage.POLL) {
            return;
        }
        pollCount += 1;
        webView.evaluateJavascript(
            pendingWtrlabReaderJs,
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
                    blockedPollCount += 1;
                    if (blockedPollCount == 12 || blockedPollCount == 30) {
                        webView.reload();
                    }
                    if (blockedPollCount >= MAX_BLOCKED_POLLS) {
                        failActiveCall("حماية الموقع تمنع الاتصال (Cloudflare)");
                        return;
                    }
                    scheduleNextPoll(webView);
                    return;
                }
                blockedPollCount = 0;
                if (!payload.optBoolean("ready", false)) {
                    scheduleNextPoll(webView);
                    return;
                }
                resolveWtrlabCall(payload.optJSONObject("payload"));
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
        markHostSession(pendingTargetUrl);
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
        cleanupActiveRequest();
        if (call != null) {
            call.reject(message);
        }
        startNextQueuedHtmlFetch();
    }

    private String fetchHtmlDirect(String url) {
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(25_000);
            connection.setReadTimeout(25_000);
            connection.setRequestProperty("User-Agent", USER_AGENT);
            connection.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            connection.setRequestProperty("Accept-Language", "en,ar;q=0.8");
            connection.setRequestProperty("Referer", refererFor(url));
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null && !cookies.isEmpty()) {
                connection.setRequestProperty("Cookie", cookies);
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                return "";
            }
            byte[] bytes = readStream(connection.getInputStream());
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return "";
        }
    }

    private boolean isCloudflareChallengeHtml(String html) {
        if (html == null || html.isEmpty()) {
            return true;
        }
        if (html.contains("Just a moment") || html.contains("Checking your browser") || html.contains("Attention Required")) {
            return true;
        }
        String lower = html.toLowerCase(Locale.ROOT);
        return lower.contains("cdn-cgi/challenge-platform")
            || lower.contains("cf-browser-verification")
            || lower.contains("challenges.cloudflare.com");
    }

    private boolean looksLikeSourceHtml(String html) {
        if (html == null || html.length() < 400) {
            return false;
        }
        if (isCloudflareChallengeHtml(html)) {
            return false;
        }
        return html.contains("page-item-detail")
            || html.contains("wp-manga")
            || html.contains("manga-item")
            || html.contains("novel-item")
            || html.contains("data-wor-library")
            || html.contains("reading-content")
            || html.contains("ts-post-image")
            || html.contains("bg-card")
            || html.contains("novel-title");
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
        blockedPollCount = 0;
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

    private void markHostSession(String url) {
        if (url == null || url.isEmpty()) {
            return;
        }
        hostSessionAt.put(sourceHostFor(url).host, System.currentTimeMillis());
    }

    private String refererFor(String url) {
        try {
            String host = normalizeHost(new URI(url).getHost());
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
            if (AZORA_STORAGE_HOST.equals(host)) {
                return true;
            }
            if (isMangalikHost(host)) {
                return path.startsWith("/manga/") || path.startsWith("/wp-content/uploads/");
            }
            if (!isAllowedUrl(url)) {
                return false;
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
            if ("novelphoenix.com".equals(host)) {
                return path.startsWith("/server-") || path.startsWith("/logo");
            }
            if (host.endsWith("hencover.xyz")) {
                return path.matches("(?i).+\\.(webp|jpe?g|png|avif|gif)$");
            }
            if ("novelsparadise.site".equals(host) || "kolnovel.com".equals(host)) {
                return path.startsWith("/wp-content/uploads/") || path.startsWith("/series/");
            }
            if ("hentairead.com".equals(host)) {
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
