package com.manhaw.livingarchive;

import android.app.Activity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ImmersiveMode")
public class ImmersiveModePlugin extends Plugin {

    private static final int INSET_REFRESH_MS = 280;
    private boolean immersiveActive = false;
    private final Runnable insetRefresh = this::requestDecorInsets;

    @PluginMethod
    public void enter(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            applyImmersive(true);
            call.resolve();
        });
    }

    @PluginMethod
    public void exit(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            applyImmersive(false);
            call.resolve();
        });
    }

    private void applyImmersive(boolean active) {
        Activity activity = getActivity();
        if (activity == null) return;
        Window window = activity.getWindow();
        if (window == null) return;

        if (immersiveActive == active) {
            if (active) scheduleInsetRefresh(window);
            return;
        }
        immersiveActive = active;

        if (active) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            if (active) {
                controller.hide(WindowInsetsCompat.Type.systemBars());
                controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                );
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars());
            }
        }
        scheduleInsetRefresh(window);
    }

    private void scheduleInsetRefresh(Window window) {
        View decorView = window.getDecorView();
        decorView.removeCallbacks(insetRefresh);
        requestDecorInsets();
        decorView.postDelayed(insetRefresh, INSET_REFRESH_MS);
    }

    private void requestDecorInsets() {
        Activity activity = getActivity();
        if (activity == null) return;
        Window window = activity.getWindow();
        if (window == null) return;
        ViewCompat.requestApplyInsets(window.getDecorView());
    }
}
