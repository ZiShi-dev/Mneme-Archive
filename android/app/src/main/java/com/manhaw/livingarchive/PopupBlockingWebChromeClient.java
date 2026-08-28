package com.manhaw.livingarchive;

import android.os.Message;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Bloque les fenêtres/popups créées par window.open() dans la WebView principale
 * (y compris depuis des iframes embed type VOE).
 */
public class PopupBlockingWebChromeClient extends BridgeWebChromeClient {

    public PopupBlockingWebChromeClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        return false;
    }
}
