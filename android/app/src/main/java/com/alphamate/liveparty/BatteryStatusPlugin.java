package com.alphamate.liveparty;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Reports live Android device battery level and charging status for active stream/party alerts. */
@CapacitorPlugin(name = "BatteryStatus")
public class BatteryStatusPlugin extends Plugin {
    private BroadcastReceiver batteryReceiver;
    private int lastLevel = -1;
    private boolean lastCharging = false;

    private JSObject extractBatteryInfo(Intent intent) {
        int level = -1;
        boolean isCharging = false;
        if (intent != null) {
            int rawLevel = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            if (rawLevel >= 0 && scale > 0) {
                level = Math.max(0, Math.min(100, Math.round((rawLevel * 100f) / scale)));
            }
            int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL;
        }
        JSObject data = new JSObject();
        data.put("level", level);
        data.put("isCharging", isCharging);
        return data;
    }

    @Override
    public void load() {
        super.load();
        Context ctx = getContext();
        if (ctx == null || batteryReceiver != null) {
            return;
        }
        batteryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject info = extractBatteryInfo(intent);
                int level = info.optInt("level", -1);
                boolean charging = info.optBoolean("isCharging", false);
                if (level >= 0 && (level != lastLevel || charging != lastCharging)) {
                    lastLevel = level;
                    lastCharging = charging;
                    notifyListeners("batteryChanged", info);
                }
            }
        };
        try {
            ctx.registerReceiver(batteryReceiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        } catch (Exception ignored) {
            batteryReceiver = null;
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            JSObject fallback = new JSObject();
            fallback.put("level", -1);
            fallback.put("isCharging", false);
            call.resolve(fallback);
            return;
        }
        try {
            Intent intent = ctx.registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            JSObject info = extractBatteryInfo(intent);
            call.resolve(info);
        } catch (Exception e) {
            JSObject fallback = new JSObject();
            fallback.put("level", -1);
            fallback.put("isCharging", false);
            call.resolve(fallback);
        }
    }

    @Override
    protected void handleOnDestroy() {
        Context ctx = getContext();
        if (ctx != null && batteryReceiver != null) {
            try {
                ctx.unregisterReceiver(batteryReceiver);
            } catch (Exception ignored) {}
            batteryReceiver = null;
        }
        super.handleOnDestroy();
    }
}
