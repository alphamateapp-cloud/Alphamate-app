package com.alphamate.liveparty;

import android.os.Build;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.UUID;

@CapacitorPlugin(name = "DeviceSecurity")
public class DeviceSecurityPlugin extends Plugin {
    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("alpha_mate_security", Context.MODE_PRIVATE);
            String installId = prefs.getString("installation_id", null);
            if (installId == null) {
                installId = UUID.randomUUID().toString();
                prefs.edit().putString("installation_id", installId).apply();
            }
            JSObject result = new JSObject();
            result.put("installationId", installId);
            result.put("brand", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
            result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
            result.put("model", Build.MODEL == null ? "" : Build.MODEL);
            result.put("device", Build.DEVICE == null ? "" : Build.DEVICE);
            result.put("product", Build.PRODUCT == null ? "" : Build.PRODUCT);
            result.put("androidVersion", Build.VERSION.RELEASE == null ? "" : Build.VERSION.RELEASE);
            result.put("androidApi", Build.VERSION.SDK_INT);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to read device information", e);
        }
    }
}
