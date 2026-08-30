package com.manhaw.livingarchive;

import android.annotation.SuppressLint;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "ParadiseChapterFetcher")
public class ParadiseChapterFetcherPlugin extends Plugin {

    private static final String[] ALLOWED_HOSTS = { "novelsparadise.site", "kolnovel.com" };
    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36";
    private static final int OVERALL_TIMEOUT_MS = 5 * 60_000;
    private static final long HOST_SESSION_TTL_MS = 15 * 60_000;
    private static final Map<String, Long> hostSessionAt = new ConcurrentHashMap<>();
    private static final String EXTRACT_JS =
        "(function(){try{"
            + "var html=document.documentElement?document.documentElement.outerHTML:'';"
            + "var body=document.body?document.body.innerHTML:'';"
            + "var cfHard=/Just a moment|Attention Required!?|Checking your browser/i;"
            + "var cfSoft=/cf-chl-|cdn-cgi\\/challenge-platform|cf-browser-verification|cf-turnstile|__cf_chl_opt|challenges\\.cloudflare\\.com/i;"
            + "var hasContent=/epcontent|entry-content|text-chapter|ts-post-image|<article\\b/i.test(body);"
            + "if(cfHard.test(html)||cfHard.test(body)||((cfSoft.test(html)||cfSoft.test(body))&&!hasContent)){return JSON.stringify({ready:false,blocked:true});}"
            + "var titleEl=document.querySelector('h1.entry-title');"
            + "var content=document.querySelector('.epcontent.entry-content');"
            + "if(!content){return JSON.stringify({ready:false});}"
            + "var paragraphs=[].slice.call(content.querySelectorAll('p')).map(function(p){return (p.innerText||'').trim();}).filter(function(text){return text.length>1 && !/تفعيل JavaScript|unlock|اشترك/i.test(text);});"
            + "if(!paragraphs.length){return JSON.stringify({ready:false});}"
            + "return JSON.stringify({ready:true,title:((titleEl&&titleEl.innerText)||'').trim()||'فصل',paragraphs:paragraphs});"
            + "}catch(error){return JSON.stringify({ready:false,error:String(error)});}})();";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = () -> failActiveCall("انتهت مهلة تحميل الفصل");
    private WebView parseWebView;
    private PluginCall activeCall;
    private String pendingChapterUrl;
    private String pendingSeriesUrl;

    @PluginMethod
    public void cancelPending(PluginCall call) {
        PluginCall current = activeCall;
        if (current != null) {
            activeCall = null;
            cleanupActiveRequest();
            current.reject("cancelled");
        }
        call.resolve();
    }

    @PluginMethod
    public void fetchChapter(PluginCall call) {
        String url = call.getString("url", "").trim();
        String seriesUrl = call.getString("seriesUrl", "").trim();
        if (!isAllowedChapterUrl(url)) {
            call.reject("رابط الفصل غير مسموح");
            return;
        }
        if (activeCall != null) {
            call.reject("جاري تحميل فصل آخر");
            return;
        }

        activeCall = call;
        pendingChapterUrl = url;
        pendingSeriesUrl = isAllowedSeriesUrl(seriesUrl) ? seriesUrl : deriveSeriesUrl(url);
        handler.postDelayed(timeoutRunnable, OVERALL_TIMEOUT_MS);
        fetchChapterViaHttp();
    }

    private void fetchChapterViaHttp() {
        final String chapterUrl = pendingChapterUrl;
        if (chapterUrl == null || chapterUrl.isEmpty() || activeCall == null) {
            return;
        }

        new Thread(
                () -> {
                    String html = fetchHtmlDirect(chapterUrl);
                    boolean blocked = isCloudflareChallengeHtml(html);
                    if (!blocked && html != null && !html.isEmpty()) {
                        getActivity()
                            .runOnUiThread(
                                () -> {
                                    if (activeCall == null || !chapterUrl.equals(pendingChapterUrl)) {
                                        return;
                                    }
                                    parseChapterHtml(chapterUrl, html);
                                }
                            );
                        return;
                    }
                    getActivity()
                        .runOnUiThread(
                            () -> {
                                if (activeCall == null || !chapterUrl.equals(pendingChapterUrl)) {
                                    return;
                                }
                                failActiveCall("حماية Novels Paradise تمنع قراءة الفصول (Cloudflare)");
                            }
                        );
                }
            )
            .start();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void parseChapterHtml(String chapterUrl, String html) {
        cleanupParseWebView();
        WebView webView = new WebView(getContext());
        parseWebView = webView;
        configureWebView(webView);
        webView.setAlpha(0.01f);
        webView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        ViewGroup root = getActivity().findViewById(android.R.id.content);
        root.addView(webView, new FrameLayout.LayoutParams(1, 1));

        webView.setWebViewClient(
            new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String loadedUrl) {
                    if (parseWebView != view || activeCall == null) {
                        return;
                    }
                    view.evaluateJavascript(
                        EXTRACT_JS,
                        value -> {
                            if (activeCall == null) {
                                return;
                            }
                            JSONObject payload = parseEvaluateResult(value);
                            if (payload != null && payload.optBoolean("ready", false)) {
                                resolveActiveCall(payload);
                                return;
                            }
                            failActiveCall("تعذر استخراج محتوى الفصل");
                        }
                    );
                }
            }
        );
        webView.loadDataWithBaseURL(chapterUrl, html, "text/html", "UTF-8", null);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView webView) {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUserAgentString(USER_AGENT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
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

    private void resolveActiveCall(JSONObject payload) {
        PluginCall call = activeCall;
        if (call == null) {
            return;
        }
        JSObject result = new JSObject();
        result.put("title", payload.optString("title", "فصل"));
        result.put("url", pendingChapterUrl);
        JSArray paragraphs = new JSArray();
        JSONArray rawParagraphs = payload.optJSONArray("paragraphs");
        if (rawParagraphs != null) {
            for (int index = 0; index < rawParagraphs.length(); index += 1) {
                String paragraph = rawParagraphs.optString(index, "").trim();
                if (!paragraph.isEmpty()) {
                    paragraphs.put(paragraph);
                }
            }
        }
        result.put("paragraphs", paragraphs);
        markHostSession(pendingChapterUrl);
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
        pendingChapterUrl = null;
        pendingSeriesUrl = null;
        activeCall = null;
        handler.removeCallbacks(timeoutRunnable);
        cleanupParseWebView();
    }

    private void cleanupParseWebView() {
        if (parseWebView == null) {
            return;
        }
        WebView webView = parseWebView;
        parseWebView = null;
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

    private boolean isAllowedHost(String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        for (String allowed : ALLOWED_HOSTS) {
            if (allowed.equals(normalized) || ("www." + allowed).equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private void markHostSession(String chapterUrl) {
        try {
            hostSessionAt.put(apexHostFor(new URI(chapterUrl).getHost()), System.currentTimeMillis());
        } catch (Exception ignored) {
            // Ignore invalid chapter URLs.
        }
    }

    private String apexHostFor(String host) {
        String normalized = host == null ? "" : host.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("www.")) {
            normalized = normalized.substring(4);
        }
        for (String allowed : ALLOWED_HOSTS) {
            if (allowed.equals(normalized)) {
                return allowed;
            }
        }
        return ALLOWED_HOSTS[0];
    }

    private String refererFor(String url) {
        try {
            return "https://" + apexHostFor(new URI(url).getHost()) + "/";
        } catch (Exception ignored) {
            return "https://novelsparadise.site/";
        }
    }

    private boolean isAllowedChapterUrl(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !isAllowedHost(host)) {
                return false;
            }
            String slug = uri.getPath().replaceAll("^/|/$", "");
            if (host.contains("kolnovel.com")) {
                return slug.matches("(?i)shaag24.+z435ggye-\\d+$");
            }
            return !slug.isEmpty() && !"series".equals(slug) && slug.matches(".*-\\d+$");
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isAllowedSeriesUrl(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !isAllowedHost(host)) {
                return false;
            }
            return uri.getPath().contains("/series/");
        } catch (Exception error) {
            return false;
        }
    }

    private String deriveSeriesUrl(String chapterUrl) {
        try {
            URI uri = new URI(chapterUrl);
            String host = apexHostFor(uri.getHost());
            String slug = uri.getPath().replaceAll("^/|/$", "");
            if ("kolnovel.com".equals(host)) {
                java.util.regex.Matcher matcher = java.util.regex.Pattern
                    .compile("(?i)^shaag24(.+?)z435ggye-\\d+$")
                    .matcher(slug);
                if (matcher.find()) {
                    return "https://kolnovel.com/series/" + matcher.group(1) + "/";
                }
            }
            String seriesSlug = slug.replaceAll("-\\d+$", "");
            return "https://" + host + "/series/" + seriesSlug + "/";
        } catch (Exception error) {
            return "https://novelsparadise.site/series/";
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
