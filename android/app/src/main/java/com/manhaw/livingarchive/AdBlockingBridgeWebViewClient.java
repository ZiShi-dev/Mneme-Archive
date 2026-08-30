package com.manhaw.livingarchive;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Bloque les redirections / pubs (Google Ads, popunders) qui sortent du lecteur embed.
 * Conserve Drive / Googleusercontent pour les embeds Drive légitimes.
 */
public class AdBlockingBridgeWebViewClient extends BridgeWebViewClient {

    private static final Pattern AD_HOST = Pattern.compile(
        "(^|\\.)("
            + "doubleclick\\.net|googlesyndication\\.com|googleadservices\\.com|"
            + "googletagmanager\\.com|googletagservices\\.com|google-analytics\\.com|"
            + "adservice\\.google\\.[a-z0-9.-]+|pagead2\\.googlesyndication\\.com|"
            + "adssettings\\.google\\.[a-z0-9.-]+|fundingchoicesmessages\\.google\\.com|"
            + "popads\\.net|exoclick\\.com|clickadu\\.com|adsterra\\.com|"
            + "propellerads\\.com|outbrain\\.com|taboola\\.com|mgid\\.com|"
            + "revcontent\\.com|juicyads\\.com|trafficjunky\\.net|tsyndicate\\.com|"
            + "adnxs\\.com|rubiconproject\\.com|pubmatic\\.com|openx\\.net|"
            + "play\\.google\\.com|market\\.android\\.com"
            + ")$",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern ALLOWED_GOOGLE_HOST = Pattern.compile(
        "(^|\\.)(drive\\.google\\.com|googleusercontent\\.com)$",
        Pattern.CASE_INSENSITIVE
    );

    public AdBlockingBridgeWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (shouldBlock(url)) {
            return emptyResponse();
        }
        return super.shouldInterceptRequest(view, request);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (shouldBlock(url)) {
            return true;
        }
        String scheme = url != null ? String.valueOf(url.getScheme()).toLowerCase(Locale.ROOT) : "";
        if ("intent".equals(scheme) || "market".equals(scheme) || "android-app".equals(scheme)) {
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    static boolean shouldBlock(Uri url) {
        if (url == null) {
            return false;
        }
        String scheme = String.valueOf(url.getScheme()).toLowerCase(Locale.ROOT);
        if ("intent".equals(scheme) || "market".equals(scheme) || "android-app".equals(scheme)) {
            return true;
        }
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return false;
        }
        String host = url.getHost();
        if (host == null || host.isEmpty()) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.ROOT);
        if (ALLOWED_GOOGLE_HOST.matcher(normalized).find()) {
            return false;
        }
        if (AD_HOST.matcher(normalized).find()) {
            return true;
        }
        if (isGoogleRedirectHost(normalized) && looksLikeAdOrStoreRedirect(url)) {
            return true;
        }
        return false;
    }

    private static boolean isGoogleRedirectHost(String host) {
        return host.equals("google.com")
            || host.equals("www.google.com")
            || host.endsWith(".google.com")
            || host.equals("google.fr")
            || host.equals("www.google.fr")
            || host.matches("^(www\\.)?google\\.[a-z.]{2,}$");
    }

    private static boolean looksLikeAdOrStoreRedirect(Uri url) {
        String path = url.getPath() == null ? "" : url.getPath().toLowerCase(Locale.ROOT);
        String query = url.getQuery() == null ? "" : url.getQuery().toLowerCase(Locale.ROOT);
        String full = path + "?" + query;
        return full.contains("/aclk")
            || full.contains("/pagead")
            || full.contains("/ads")
            || full.contains("adurl=")
            || full.contains("/url?")
            || full.contains("ved=")
            || path.equals("/")
            || path.isEmpty()
            || path.startsWith("/search")
            || path.startsWith("/store")
            || path.startsWith("/intl");
    }

    private static WebResourceResponse emptyResponse() {
        byte[] body = new byte[0];
        return new WebResourceResponse(
            "text/plain",
            StandardCharsets.UTF_8.name(),
            new ByteArrayInputStream(body)
        );
    }
}
