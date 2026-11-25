package com.alphamate.liveparty;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import io.agora.rtc2.ChannelMediaOptions;
import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.IRtcEngineEventHandler.AudioVolumeInfo;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "AgoraParty",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class AgoraPartyPlugin extends Plugin {
    private final Object engineLock = new Object();
    private RtcEngine engine;
    private String currentChannel = null;
    private int localUid = 0;
    private volatile boolean isPublishing = false;
    private volatile boolean userMuted = true;
    private volatile boolean mutedForAudioFocus = false;
    private volatile boolean desiredSpeakerphone = true;
    private volatile int lastMeasuredRttMs = -1;
    private final AtomicBoolean joining = new AtomicBoolean(false);

    private AudioFocusRequest audioFocusRequest = null;

    private final AudioManager.OnAudioFocusChangeListener focusChangeListener = focusChange -> {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        AudioManager am = getAudioManager();
        boolean isPhoneCallActive = false;
        if (am != null) {
            try {
                int mode = am.getMode();
                isPhoneCallActive =
                    mode == AudioManager.MODE_IN_CALL ||
                    mode == AudioManager.MODE_RINGTONE;
            } catch (Exception ignored) {}
        }

        if (focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
            // Only pause mic during a real incoming/active phone call; ignore internal WebView media focus churn
            // (e.g., gift animations playing inside our own app must NEVER mute Party Voice).
            if (isPhoneCallActive) {
                mutedForAudioFocus = true;
                if (currentEngine != null && isPublishing && !userMuted) {
                    try {
                        currentEngine.muteLocalAudioStream(true);
                    } catch (Exception ignored) {}
                }
            }
            JSObject data = new JSObject();
            data.put("focused", !isPhoneCallActive);
            data.put("reason", isPhoneCallActive ? "phone_call" : "transient_ignored");
            notifyListeners("audioFocusChanged", data);
        } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            // Never mute Party Voice on duckable sounds or UI effects.
            JSObject data = new JSObject();
            data.put("focused", true);
            data.put("reason", "duck_ignored");
            notifyListeners("audioFocusChanged", data);
        } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
            // Internal WebView <video> / AudioContext playback can trigger AUDIOFOCUS_LOSS inside the same app.
            // Never permanently mute Party Voice when the user is still inside our active room;
            // only pause if an actual telephony call took over.
            if (isPhoneCallActive) {
                mutedForAudioFocus = true;
                if (currentEngine != null && isPublishing && !userMuted) {
                    try {
                        currentEngine.muteLocalAudioStream(true);
                    } catch (Exception ignored) {}
                }
            } else if (currentEngine != null) {
                // Re-assert voice audio routing so WebView media cannot silence remote Party speakers.
                mutedForAudioFocus = false;
                try {
                    if (isPublishing && !userMuted) {
                        currentEngine.muteLocalAudioStream(false);
                    }
                    applyOptimalAudioRoute(currentEngine);
                } catch (Exception ignored) {}
            }
            JSObject data = new JSObject();
            data.put("focused", !isPhoneCallActive);
            data.put("reason", isPhoneCallActive ? "phone_call" : "in_app_preserved");
            notifyListeners("audioFocusChanged", data);
        } else if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
            boolean wasInterrupted = mutedForAudioFocus;
            mutedForAudioFocus = false;
            if (currentEngine != null) {
                try {
                    if (wasInterrupted && isPublishing) {
                        currentEngine.muteLocalAudioStream(userMuted);
                    }
                    applyOptimalAudioRoute(currentEngine);
                } catch (Exception ignored) {}
            }
            JSObject data = new JSObject();
            data.put("focused", true);
            data.put("reason", "gain");
            notifyListeners("audioFocusChanged", data);
        }
    };

    private final IRtcEngineEventHandler handler = new IRtcEngineEventHandler() {
        @Override
        public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
            joining.set(false);
            currentChannel = channel;
            localUid = uid;
            applyOptimalAudioRoute(engine);
            JSObject data = new JSObject();
            data.put("channel", channel);
            data.put("uid", uid);
            data.put("elapsed", elapsed);
            notifyListeners("joined", data);
        }

        @Override
        public void onRejoinChannelSuccess(String channel, int uid, int elapsed) {
            joining.set(false);
            currentChannel = channel;
            localUid = uid;
            applyOptimalAudioRoute(engine);
            JSObject data = new JSObject();
            data.put("channel", channel);
            data.put("uid", uid);
            data.put("elapsed", elapsed);
            data.put("rejoined", true);
            notifyListeners("joined", data);
        }

        @Override
        public void onUserJoined(int uid, int elapsed) {
            JSObject data = new JSObject();
            data.put("uid", uid);
            data.put("elapsed", elapsed);
            notifyListeners("userJoined", data);
        }

        @Override
        public void onUserOffline(int uid, int reason) {
            JSObject data = new JSObject();
            data.put("uid", uid);
            data.put("reason", reason);
            notifyListeners("userOffline", data);
        }

        @Override
        public void onUserMuteAudio(int uid, boolean muted) {
            JSObject data = new JSObject();
            data.put("uid", uid);
            data.put("muted", muted);
            notifyListeners("userMuteAudio", data);
        }

        @Override
        public void onRemoteAudioStateChanged(int uid, int state, int reason, int elapsed) {
            if (state == Constants.REMOTE_AUDIO_STATE_STOPPED &&
                (reason == Constants.REMOTE_AUDIO_REASON_REMOTE_MUTED ||
                 reason == Constants.REMOTE_AUDIO_REASON_LOCAL_MUTED)) {
                JSObject data = new JSObject();
                data.put("uid", uid);
                data.put("muted", true);
                notifyListeners("userMuteAudio", data);
            } else if (state == Constants.REMOTE_AUDIO_STATE_DECODING &&
                reason == Constants.REMOTE_AUDIO_REASON_REMOTE_UNMUTED) {
                JSObject data = new JSObject();
                data.put("uid", uid);
                data.put("muted", false);
                notifyListeners("userMuteAudio", data);
            }
        }

        @Override
        public void onConnectionStateChanged(int state, int reason) {
            if (state == Constants.CONNECTION_STATE_DISCONNECTED ||
                state == Constants.CONNECTION_STATE_FAILED ||
                state == Constants.CONNECTION_STATE_CONNECTED) {
                joining.set(false);
            }
            JSObject data = new JSObject();
            data.put("state", state);
            data.put("reason", reason);
            notifyListeners("connectionState", data);
        }

        @Override
        public void onTokenPrivilegeWillExpire(String token) {
            JSObject data = new JSObject();
            data.put("token", token);
            notifyListeners("tokenWillExpire", data);
        }

        @Override
        public void onRequestToken() {
            JSObject data = new JSObject();
            notifyListeners("requestToken", data);
        }

        @Override
        public void onAudioRouteChanged(int routing) {
            JSObject data = new JSObject();
            data.put("routing", routing);
            notifyListeners("audioRouteChanged", data);
        }

        @Override
        public void onError(int err) {
            joining.set(false);
            JSObject data = new JSObject();
            data.put("code", err);
            notifyListeners("error", data);
        }

        @Override
        public void onAudioVolumeIndication(AudioVolumeInfo[] speakers, int totalVolume) {
            JSObject data = new JSObject();
            data.put("totalVolume", totalVolume);
            JSArray arr = new JSArray();
            if (speakers != null) {
                for (AudioVolumeInfo s : speakers) {
                    JSObject item = new JSObject();
                    item.put("uid", s.uid);
                    item.put("volume", s.volume);
                    item.put("vad", s.vad);
                    arr.put(item);
                }
            }
            data.put("speakers", arr);
            notifyListeners("audioVolume", data);
        }

        @Override
        public void onRtcStats(RtcStats stats) {
            if (stats != null && stats.lastmileDelay >= 0) {
                lastMeasuredRttMs = stats.lastmileDelay;
            }
        }

        @Override
        public void onNetworkQuality(int uid, int txQuality, int rxQuality) {
            if (uid != 0) return;
            JSObject data = new JSObject();
            data.put("txQuality", txQuality);
            data.put("rxQuality", rxQuality);
            data.put("rttMs", lastMeasuredRttMs);
            notifyListeners("networkQuality", data);
        }
    };

    private AudioManager getAudioManager() {
        Context ctx = getContext();
        return ctx != null ? (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE) : null;
    }

    private boolean hasExternalAudioOutput(AudioManager audioManager) {
        if (audioManager == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                AudioDeviceInfo[] outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                for (AudioDeviceInfo dev : outputs) {
                    int type = dev.getType();
                    if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                        type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                        type == AudioDeviceInfo.TYPE_USB_HEADSET ||
                        type == AudioDeviceInfo.TYPE_USB_DEVICE ||
                        type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                         (type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
                          type == AudioDeviceInfo.TYPE_BLE_SPEAKER ||
                          type == AudioDeviceInfo.TYPE_HEARING_AID))) {
                        return true;
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private void applyOptimalAudioRoute(RtcEngine targetEngine) {
        if (targetEngine == null) return;
        AudioManager audioManager = getAudioManager();
        boolean externalConnected = hasExternalAudioOutput(audioManager);
        try {
            if (!desiredSpeakerphone) {
                targetEngine.setEnableSpeakerphone(false);
            } else if (externalConnected) {
                // Respect wired headset / Bluetooth earphones instead of forcing phone loudspeaker.
                targetEngine.setDefaultAudioRoutetoSpeakerphone(true);
            } else {
                targetEngine.setDefaultAudioRoutetoSpeakerphone(true);
                targetEngine.setEnableSpeakerphone(true);
            }
        } catch (Exception ignored) {
        }
    }

    private void requestPartyAudioFocus() {
        AudioManager audioManager = getAudioManager();
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (audioFocusRequest == null) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attrs)
                        .setAcceptsDelayedFocusGain(true)
                        .setWillPauseWhenDucked(false)
                        .setOnAudioFocusChangeListener(focusChangeListener)
                        .build();
                }
                audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                audioManager.requestAudioFocus(
                    focusChangeListener,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
                );
            }
        } catch (Exception ignored) {
        }
    }

    private void abandonPartyAudioFocus() {
        AudioManager audioManager = getAudioManager();
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            } else {
                audioManager.abandonAudioFocus(focusChangeListener);
            }
            audioManager.setSpeakerphoneOn(false);
            audioManager.setMode(AudioManager.MODE_NORMAL);
        } catch (Exception ignored) {
        } finally {
            mutedForAudioFocus = false;
        }
    }

    private boolean hasMicrophonePermission() {
        Context ctx = getContext();
        return ctx != null &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void updateForegroundService(boolean shouldRun) {
        Context ctx = getContext();
        if (ctx == null) return;
        try {
            Intent intent = new Intent(ctx, PartyVoiceForegroundService.class);
            if (shouldRun && hasMicrophonePermission()) {
                ContextCompat.startForegroundService(ctx, intent);
            } else {
                ctx.stopService(intent);
            }
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        String appId = call.getString("appId", "").trim();
        if (appId.isEmpty()) {
            call.reject("Agora App ID is required", "AGORA_APP_ID_REQUIRED");
            return;
        }
        synchronized (engineLock) {
            if (engine != null) {
                JSObject out = new JSObject();
                out.put("initialized", true);
                call.resolve(out);
                return;
            }
            try {
                RtcEngineConfig config = new RtcEngineConfig();
                config.mContext = getContext().getApplicationContext();
                config.mAppId = appId;
                config.mEventHandler = handler;
                config.mChannelProfile = Constants.CHANNEL_PROFILE_LIVE_BROADCASTING;
                config.mAudioScenario = Constants.AUDIO_SCENARIO_CHATROOM;
                RtcEngine created = RtcEngine.create(config);
                created.setAudioProfile(
                    Constants.AUDIO_PROFILE_MUSIC_STANDARD,
                    Constants.AUDIO_SCENARIO_CHATROOM
                );
                created.enableAudio();
                created.enableAudioVolumeIndication(200, 3, true);
                created.setDefaultAudioRoutetoSpeakerphone(true);
                // Keep video completely disabled in Party Rooms; Solo Live owns video via WebRTC.
                created.disableVideo();
                engine = created;
                JSObject out = new JSObject();
                out.put("initialized", true);
                call.resolve(out);
            } catch (Exception e) {
                engine = null;
                call.reject("Agora initialization failed: " + e.getMessage(), "AGORA_INIT_FAILED", e);
            }
        }
    }

    @PluginMethod
    public void join(PluginCall call) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Call initialize before join", "AGORA_NOT_INITIALIZED");
            return;
        }
        String channel = call.getString("channel", "").trim();
        String token = call.getString("token", "");
        int uid = call.getInt("uid", 0);
        boolean publish = call.getBoolean("publish", true);
        if (channel.isEmpty() || token.isEmpty() || uid <= 0) {
            call.reject("channel, token and positive uid are required", "AGORA_JOIN_ARGUMENTS");
            return;
        }
        if (joining.getAndSet(true)) {
            call.reject("Agora join is already in progress", "AGORA_JOINING");
            return;
        }
        // Listening-only viewers do not need microphone permission. Request it only
        // when this client is actually publishing audio as host / seated speaker.
        if (publish && !hasMicrophonePermission()) {
            joining.set(false);
            requestPermissionForAlias("microphone", call, "joinAfterMicrophonePermission");
            return;
        }
        joinGranted(call, channel, token, uid, publish);
    }

    @PermissionCallback
    private void joinAfterMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            joining.set(false);
            call.reject("Microphone permission is required", "MIC_PERMISSION_REQUIRED");
            return;
        }
        String channel = call.getString("channel", "").trim();
        String token = call.getString("token", "");
        int uid = call.getInt("uid", 0);
        boolean publish = call.getBoolean("publish", true);
        if (joining.getAndSet(true)) {
            call.reject("Agora join is already in progress", "AGORA_JOINING");
            return;
        }
        joinGranted(call, channel, token, uid, publish);
    }

    private void joinGranted(PluginCall call, String channel, String token, int uid, boolean publish) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            joining.set(false);
            call.reject("Call initialize before join", "AGORA_NOT_INITIALIZED");
            return;
        }
        try {
            requestPartyAudioFocus();
            isPublishing = publish;
            if (!publish) {
                userMuted = true;
            }
            if (currentChannel != null && !currentChannel.equals(channel)) {
                try {
                    currentEngine.leaveChannel();
                } catch (Exception ignored) {}
            }
            currentEngine.setClientRole(
                publish ? Constants.CLIENT_ROLE_BROADCASTER : Constants.CLIENT_ROLE_AUDIENCE
            );
            ChannelMediaOptions options = new ChannelMediaOptions();
            options.clientRoleType = publish
                ? Constants.CLIENT_ROLE_BROADCASTER
                : Constants.CLIENT_ROLE_AUDIENCE;
            options.publishMicrophoneTrack = publish;
            options.autoSubscribeAudio = true;
            options.autoSubscribeVideo = false;
            int result = currentEngine.joinChannel(token, channel, uid, options);
            if (result != 0) {
                joining.set(false);
                updateForegroundService(false);
                call.reject("Agora joinChannel failed: " + result, "AGORA_JOIN_FAILED");
                return;
            }
            updateForegroundService(publish);
            applyOptimalAudioRoute(currentEngine);
            JSObject out = new JSObject();
            out.put("accepted", true);
            out.put("channel", channel);
            out.put("uid", uid);
            call.resolve(out);
        } catch (Exception e) {
            joining.set(false);
            updateForegroundService(false);
            call.reject("Agora join failed: " + e.getMessage(), "AGORA_JOIN_FAILED", e);
        }
    }

    @PluginMethod
    public void renewToken(PluginCall call) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED");
            return;
        }
        String token = call.getString("token", "").trim();
        if (token.isEmpty()) {
            call.reject("A renewed Agora token is required", "AGORA_TOKEN_REQUIRED");
            return;
        }
        int result = currentEngine.renewToken(token);
        if (result != 0) {
            call.reject("Unable to renew Agora token: " + result, "AGORA_TOKEN_RENEW_FAILED");
            return;
        }
        JSObject out = new JSObject();
        out.put("renewed", true);
        call.resolve(out);
    }

    @PluginMethod
    public void setMuted(PluginCall call) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED");
            return;
        }
        boolean muted = call.getBoolean("muted", true);
        userMuted = muted;
        if (!muted) {
            mutedForAudioFocus = false;
            requestPartyAudioFocus();
        }
        boolean effectiveMuted = muted || mutedForAudioFocus;
        int result = currentEngine.muteLocalAudioStream(effectiveMuted);
        if (result != 0) {
            call.reject("Unable to change microphone state: " + result);
            return;
        }
        if (!muted) {
            applyOptimalAudioRoute(currentEngine);
        }
        JSObject out = new JSObject();
        out.put("muted", muted);
        call.resolve(out);
    }

    @PluginMethod
    public void setCanPublish(PluginCall call) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED");
            return;
        }
        boolean enabled = call.getBoolean("enabled", false);
        if (enabled && !hasMicrophonePermission()) {
            requestPermissionForAlias("microphone", call, "publishAfterMicrophonePermission");
            return;
        }
        applyCanPublish(call, enabled);
    }

    @PermissionCallback
    private void publishAfterMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is required to speak in the Party Room", "MIC_PERMISSION_REQUIRED");
            return;
        }
        applyCanPublish(call, true);
    }

    private void applyCanPublish(PluginCall call, boolean enabled) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED");
            return;
        }
        int result = currentEngine.setClientRole(
            enabled ? Constants.CLIENT_ROLE_BROADCASTER : Constants.CLIENT_ROLE_AUDIENCE
        );
        if (result != 0) {
            call.reject("Unable to change Agora role: " + result);
            return;
        }
        ChannelMediaOptions options = new ChannelMediaOptions();
        options.clientRoleType = enabled
            ? Constants.CLIENT_ROLE_BROADCASTER
            : Constants.CLIENT_ROLE_AUDIENCE;
        options.publishMicrophoneTrack = enabled;
        options.autoSubscribeAudio = true;
        options.autoSubscribeVideo = false;
        int update = currentEngine.updateChannelMediaOptions(options);
        if (update != 0) {
            call.reject("Unable to update Agora publishing: " + update);
            return;
        }
        isPublishing = enabled;
        if (!enabled) {
            userMuted = true;
            currentEngine.muteLocalAudioStream(true);
        }
        updateForegroundService(enabled);
        JSObject out = new JSObject();
        out.put("enabled", enabled);
        call.resolve(out);
    }

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED");
            return;
        }
        boolean enabled = call.getBoolean("enabled", true);
        desiredSpeakerphone = enabled;
        applyOptimalAudioRoute(currentEngine);
        JSObject out = new JSObject();
        out.put("enabled", enabled);
        call.resolve(out);
    }

    @PluginMethod
    public void setVoiceEffect(PluginCall call) {
        RtcEngine currentEngine;
        synchronized (engineLock) {
            currentEngine = engine;
        }
        if (currentEngine == null) {
            call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED");
            return;
        }
        String preset = call.getString("preset", "normal").trim().toLowerCase();
        try {
            currentEngine.setAudioEffectPreset(Constants.AUDIO_EFFECT_OFF);
            currentEngine.setVoiceConversionPreset(Constants.VOICE_CONVERSION_OFF);
            currentEngine.setLocalVoicePitch(1.0);
            switch (preset) {
                case "robot":
                    currentEngine.setVoiceBeautifierPreset(Constants.VOICE_BEAUTIFIER_OFF);
                    currentEngine.setAudioEffectPreset(Constants.VOICE_CHANGER_EFFECT_UNCLE);
                    currentEngine.setLocalVoicePitch(0.85);
                    break;
                case "chipmunk":
                    currentEngine.setLocalVoicePitch(1.56);
                    break;
                case "deep":
                    currentEngine.setAudioEffectPreset(Constants.VOICE_CHANGER_EFFECT_HULK);
                    break;
                case "deep_echo":
                    currentEngine.setAudioEffectPreset(Constants.ROOM_ACOUSTICS_KTV);
                    currentEngine.setLocalVoicePitch(0.74);
                    break;
                case "echo":
                    currentEngine.setAudioEffectPreset(Constants.ROOM_ACOUSTICS_KTV);
                    break;
                case "studio":
                    currentEngine.setAudioEffectPreset(Constants.ROOM_ACOUSTICS_STUDIO);
                    break;
                default:
                    preset = "normal";
                    currentEngine.setVoiceBeautifierPreset(Constants.VOICE_BEAUTIFIER_OFF);
                    break;
            }
        } catch (Exception ignored) {
            preset = "normal";
        }
        JSObject out = new JSObject();
        out.put("preset", preset);
        call.resolve(out);
    }

    @PluginMethod
    public void leave(PluginCall call) {
        joining.set(false);
        isPublishing = false;
        userMuted = true;
        synchronized (engineLock) {
            if (engine != null) {
                try {
                    engine.setAudioEffectPreset(Constants.AUDIO_EFFECT_OFF);
                    engine.setLocalVoicePitch(1.0);
                    engine.stopPreview();
                    engine.leaveChannel();
                } catch (Exception ignored) {}
            }
            currentChannel = null;
            localUid = 0;
        }
        updateForegroundService(false);
        abandonPartyAudioFocus();
        JSObject out = new JSObject();
        out.put("left", true);
        call.resolve(out);
    }

    @PluginMethod
    public void destroy(PluginCall call) {
        cleanupEngine();
        JSObject out = new JSObject();
        out.put("destroyed", true);
        call.resolve(out);
    }

    @Override
    protected void handleOnDestroy() {
        cleanupEngine();
        super.handleOnDestroy();
    }

    private void cleanupEngine() {
        joining.set(false);
        isPublishing = false;
        userMuted = true;
        synchronized (engineLock) {
            try {
                if (engine != null) {
                    engine.leaveChannel();
                    RtcEngine.destroy();
                }
            } catch (Exception ignored) {}
            engine = null;
            currentChannel = null;
            localUid = 0;
        }
        updateForegroundService(false);
        abandonPartyAudioFocus();
    }
}
