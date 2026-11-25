package com.alphamate.liveparty;

import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {
    private static final int ALPHA_MATE_DARK_BG = Color.parseColor("#09070F");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
            }
        } catch (Exception ignored) {
            // FirebaseInitProvider handles default initialization when google-services.json resources exist
        }
        registerPlugin(KeepScreenOnPlugin.class);
        registerPlugin(BatteryStatusPlugin.class);
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(AgoraPartyPlugin.class);
        registerPlugin(SystemInsetsPlugin.class);
        registerPlugin(DeviceSecurityPlugin.class);
        super.onCreate(savedInstanceState);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        configureSafeAreaSystemBars();
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setLoadsImagesAutomatically(true);
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setBackgroundColor(ALPHA_MATE_DARK_BG);
            }
        } catch (Exception ignored) {
            // Keep default WebView behavior if initialization order differs
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        configureSafeAreaSystemBars();
    }

    /**
     * Enforces universal safe-area padding across all Android versions (API 24 through Android 15/16+
     * mandatory edge-to-edge). Pads the root Activity container by exact physical systemBars,
     * displayCutout (notch / punch-hole), and soft keyboard (IME) insets so the entire WebView
     * always starts cleanly below the device status bar (time, battery, signal) and ends above
     * the system navigation bar, making every app button reliably tappable on every device.
     */
    private void configureSafeAreaSystemBars() {
        try {
            Window window = getWindow();
            if (window == null) {
                return;
            }

            View decorView = window.getDecorView();
            decorView.setBackgroundColor(ALPHA_MATE_DARK_BG);

            // Allow dark brand chrome to span behind cutouts while our root padding protects all UI
            WindowCompat.setDecorFitsSystemWindows(window, false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
                window.setAttributes(lp);
            }

            // Paint dark bars on Android 7–14 where statusBarColor/navigationBarColor are honored
            if (Build.VERSION.SDK_INT < 35) {
                window.setStatusBarColor(ALPHA_MATE_DARK_BG);
                window.setNavigationBarColor(ALPHA_MATE_DARK_BG);
            }

            // Ensure crisp white status & navigation icons against our dark #09070F chrome
            WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decorView);
            if (controller != null) {
                controller.setAppearanceLightStatusBars(false);
                controller.setAppearanceLightNavigationBars(false);
            }

            View contentView = findViewById(android.R.id.content);
            if (contentView != null) {
                contentView.setBackgroundColor(ALPHA_MATE_DARK_BG);
                final float density = getResources().getDisplayMetrics().density > 0f
                    ? getResources().getDisplayMetrics().density
                    : 1f;

                ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                    Insets sysBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                    Insets cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());
                    Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());

                    int topPx = Math.max(sysBars.top, cutout.top);
                    int leftPx = Math.max(sysBars.left, cutout.left);
                    int rightPx = Math.max(sysBars.right, cutout.right);
                    int bottomPx = Math.max(sysBars.bottom, ime.bottom);

                    view.setPadding(leftPx, topPx, rightPx, bottomPx);

                    SystemInsetsPlugin.updateLatestInsets(
                        Math.round(topPx / density),
                        Math.round(bottomPx / density),
                        Math.round(leftPx / density),
                        Math.round(rightPx / density),
                        true
                    );

                    return WindowInsetsCompat.CONSUMED;
                });

                ViewCompat.requestApplyInsets(contentView);
            }
        } catch (Exception ignored) {
            // Never crash startup if OEM WindowInsets behavior differs
        }
    }
}
