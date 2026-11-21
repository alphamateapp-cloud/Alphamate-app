package com.alphamate.liveparty;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Exposes native Android system-bar and display-cutout safe-area insets to the WebView
 * so the web layer knows when native root padding is active (preventing double padding
 * while guaranteeing zero overlap with the status bar, camera notch, or gesture bar).
 */
@CapacitorPlugin(name = "SystemInsets")
public class SystemInsetsPlugin extends Plugin {
    private static volatile int latestTopDp = 0;
    private static volatile int latestBottomDp = 0;
    private static volatile int latestLeftDp = 0;
    private static volatile int latestRightDp = 0;
    private static volatile boolean nativePaddingApplied = false;

    public static void updateLatestInsets(
        int topDp,
        int bottomDp,
        int leftDp,
        int rightDp,
        boolean appliedNatively
    ) {
        latestTopDp = Math.max(0, topDp);
        latestBottomDp = Math.max(0, bottomDp);
        latestLeftDp = Math.max(0, leftDp);
        latestRightDp = Math.max(0, rightDp);
        nativePaddingApplied = appliedNatively;
    }

    @PluginMethod
    public void getInsets(PluginCall call) {
        JSObject result = new JSObject();
        result.put("top", latestTopDp);
        result.put("bottom", latestBottomDp);
        result.put("left", latestLeftDp);
        result.put("right", latestRightDp);
        result.put("appliedNatively", nativePaddingApplied);
        call.resolve(result);
    }
}
