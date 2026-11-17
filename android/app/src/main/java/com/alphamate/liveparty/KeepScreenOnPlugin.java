package com.alphamate.liveparty;

import android.app.Activity;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Keeps the device display awake while a user is actively in a live/party session (host, guest, viewer, or audience). */
@CapacitorPlugin(name = "KeepScreenOn")
public class KeepScreenOnPlugin extends Plugin {
    private volatile boolean desiredEnabled = false;

    private void applyKeepScreenOn(boolean enabled) {
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            return;
        }
        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.getWindow() == null) {
                return;
            }
            if (enabled) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            if (getBridge() != null && getBridge().getWebView() != null) {
                View webView = getBridge().getWebView();
                webView.setKeepScreenOn(enabled);
            }
        });
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        desiredEnabled = enabled;
        applyKeepScreenOn(enabled);
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (desiredEnabled) {
            applyKeepScreenOn(true);
        }
    }

    @Override
    protected void handleOnDestroy() {
        desiredEnabled = false;
        applyKeepScreenOn(false);
        super.handleOnDestroy();
    }
}
