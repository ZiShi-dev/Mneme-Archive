package com.manhaw.livingarchive;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
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
import java.net.URI;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "ParadiseChapterFetcher")
public class ParadiseChapterFetcherPlugin extends Plugin {

    private static final String BASE_HOST = "novelsparadise.site";
    private static final String USER_AGENT =
        "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    private static final int POLL_INTERVAL_MS = 800;
    private static final int MAX_POLLS = 55;
    private static final String EXTRACT_JS =
        "(function(){try{"
            + "var body=document.body?document.body.innerHTML:'';"
            + "if(/Just a moment|cf-chl-|challenges\\.cloudflare\\.com/i.test(body)){return JSON.stringify({ready:false,blocked:true});}"
            + "var titleEl=document.querySelector('h1.entry-title');"
            + "var content=document.querySelector('.epcontent.entry-content');"
            + "if(!content){return JSON.stringify({ready:false});}"
            + "var paragraphs=[].slice.call(content.querySelectorAll('p')).map(function(p){return (p.innerText||'').trim();}).filter(function(text){return text.length>1 && !/تفعيل JavaScript|unlock|اشترك/i.test(text);});"
            + "if(!paragraphs.length){return JSON.stringify({ready:false});}"
            + "return JSON.stringify({ready:true,title:((titleEl&&titleEl.innerText)||'').trim()||'فصل',paragraphs:paragraphs});"
            + "}catch(error){return JSON.stringify({ready:false,error:String(error)});}})();";

    private enum Stage {
        SERIES,
        CHAPTER,
        POLL,
    }

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable timeoutRunnable = () -> failActiveCall("انتهت مهلة تحميل الفصل");
    private WebView activeWebView;
    private PluginCall activeCall;
    private int pollCount;
    private String pendingChapterUrl;
    private Stage stage = Stage.SERIES;

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
        pollCount = 0;
        pendingChapterUrl = url;
        stage = Stage.SERIES;
        getActivity().runOnUiThread(() -> startFetch(url, seriesUrl));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void startFetch(String chapterUrl, String seriesUrl) {
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

        final String warmupSeriesUrl = isAllowedSeriesUrl(seriesUrl) ? seriesUrl : deriveSeriesUrl(chapterUrl);
        webView.setWebViewClient(
            new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return false;
                }

                @Override
                public void onPageFinished(WebView view, String loadedUrl) {
                    if (activeWebView != view || !chapterUrl.equals(pendingChapterUrl)) {
                        return;
                    }
                    if (stage == Stage.SERIES && loadedUrl.contains("/series/")) {
                        stage = Stage.CHAPTER;
                        view.loadUrl(chapterUrl);
                        return;
                    }
                    if (stage == Stage.CHAPTER && isSameChapterUrl(loadedUrl, chapterUrl)) {
                        stage = Stage.POLL;
                        handler.postDelayed(() -> pollContent(view), POLL_INTERVAL_MS);
                    }
                }
            }
        );

        handler.postDelayed(timeoutRunnable, POLL_INTERVAL_MS * MAX_POLLS);
        webView.loadUrl(warmupSeriesUrl);
    }

    private void pollContent(WebView webView) {
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
                    failActiveCall("حماية Novels Paradise تمنع قراءة الفصول (Cloudflare)");
                    return;
                }
                if (!payload.optBoolean("ready", false)) {
                    scheduleNextPoll(webView);
                    return;
                }
                resolveActiveCall(payload);
            }
        );
    }

    private void scheduleNextPoll(WebView webView) {
        if (pollCount >= MAX_POLLS) {
            failActiveCall("تعذر استخراج محتوى الفصل");
            return;
        }
        handler.postDelayed(() -> pollContent(webView), POLL_INTERVAL_MS);
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
        activeCall = null;
        pollCount = 0;
        stage = Stage.SERIES;
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

    private boolean isSameChapterUrl(String loadedUrl, String chapterUrl) {
        try {
            URI loaded = new URI(loadedUrl);
            URI expected = new URI(chapterUrl);
            String loadedPath = loaded.getPath().replaceAll("/+$", "");
            String expectedPath = expected.getPath().replaceAll("/+$", "");
            return loadedPath.equals(expectedPath);
        } catch (Exception error) {
            return chapterUrl.equals(loadedUrl);
        }
    }

    private boolean isAllowedChapterUrl(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            if (!BASE_HOST.equals(host) && !("www." + BASE_HOST).equals(host)) {
                return false;
            }
            String slug = uri.getPath().replaceAll("^/|/$", "");
            return !slug.isEmpty() && !"series".equals(slug) && slug.matches(".*-\\d+$");
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isAllowedSeriesUrl(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            if (!BASE_HOST.equals(host) && !("www." + BASE_HOST).equals(host)) {
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
            String slug = uri.getPath().replaceAll("^/|/$", "");
            String seriesSlug = slug.replaceAll("-\\d+$", "");
            return "https://" + BASE_HOST + "/series/" + seriesSlug + "/";
        } catch (Exception error) {
            return "https://" + BASE_HOST + "/series/";
        }
    }
}
