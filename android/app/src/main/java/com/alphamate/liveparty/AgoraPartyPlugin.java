package com.alphamate.liveparty;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
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
    private RtcEngine engine;
    private String currentChannel = null;
    private int localUid = 0;
    private final AtomicBoolean joining = new AtomicBoolean(false);
    private final IRtcEngineEventHandler handler = new IRtcEngineEventHandler() {
        @Override public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
            joining.set(false);
            currentChannel = channel;
            localUid = uid;
            JSObject data = new JSObject(); data.put("channel", channel); data.put("uid", uid); data.put("elapsed", elapsed);
            notifyListeners("joined", data);
        }
        @Override public void onUserJoined(int uid, int elapsed) {
            JSObject data = new JSObject(); data.put("uid", uid); data.put("elapsed", elapsed); notifyListeners("userJoined", data);
        }
        @Override public void onUserOffline(int uid, int reason) {
            JSObject data = new JSObject(); data.put("uid", uid); data.put("reason", reason); notifyListeners("userOffline", data);
        }
        @Override public void onConnectionStateChanged(int state, int reason) {
            JSObject data = new JSObject(); data.put("state", state); data.put("reason", reason); notifyListeners("connectionState", data);
        }
        @Override public void onTokenPrivilegeWillExpire(String token) { JSObject data = new JSObject(); data.put("token", token); notifyListeners("tokenWillExpire", data); }
        @Override public void onError(int err) {
            JSObject data = new JSObject(); data.put("code", err); notifyListeners("error", data);
        }
        @Override public void onAudioVolumeIndication(AudioVolumeInfo[] speakers, int totalVolume) {
            JSObject data = new JSObject(); data.put("totalVolume", totalVolume);
            com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
            if (speakers != null) for (AudioVolumeInfo s : speakers) { JSObject item = new JSObject(); item.put("uid", s.uid); item.put("volume", s.volume); arr.put(item); }
            data.put("speakers", arr); notifyListeners("audioVolume", data);
        }
    };

    @PluginMethod public void initialize(PluginCall call) {
        String appId = call.getString("appId", "").trim();
        if (appId.isEmpty()) { call.reject("Agora App ID is required", "AGORA_APP_ID_REQUIRED"); return; }
        if (engine != null) { JSObject out = new JSObject(); out.put("initialized", true); call.resolve(out); return; }
        try {
            RtcEngineConfig config = new RtcEngineConfig();
            config.mContext = getContext().getApplicationContext(); config.mAppId = appId; config.mEventHandler = handler;
            engine = RtcEngine.create(config);
            engine.setChannelProfile(Constants.CHANNEL_PROFILE_LIVE_BROADCASTING);
            engine.enableAudio(); engine.enableAudioVolumeIndication(300, 3, true);
            engine.setDefaultAudioRoutetoSpeakerphone(true);
            JSObject out = new JSObject(); out.put("initialized", true); call.resolve(out);
        } catch (Exception e) { engine = null; call.reject("Agora initialization failed: " + e.getMessage(), "AGORA_INIT_FAILED", e); }
    }

    @PluginMethod public void join(PluginCall call) {
        if (engine == null) { call.reject("Call initialize before join", "AGORA_NOT_INITIALIZED"); return; }
        String channel = call.getString("channel", "").trim(); String token = call.getString("token", ""); int uid = call.getInt("uid", 0);
        boolean publish = call.getBoolean("publish", true);
        if (channel.isEmpty() || token.isEmpty() || uid <= 0) { call.reject("channel, token and positive uid are required", "AGORA_JOIN_ARGUMENTS"); return; }
        if (joining.getAndSet(true)) { call.reject("Agora join is already in progress", "AGORA_JOINING"); return; }
        // Listening-only viewers do not need microphone permission. Request it only
        // when this client is actually publishing audio as host / seated speaker.
        if (publish && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            joining.set(false);
            requestPermissionForAlias("microphone", call, "joinAfterMicrophonePermission");
            return;
        }
        joinGranted(call, channel, token, uid, publish);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void joinAfterMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            joining.set(false);
            call.reject("Microphone permission is required", "MIC_PERMISSION_REQUIRED"); return;
        }
        String channel = call.getString("channel", "").trim(); String token = call.getString("token", ""); int uid = call.getInt("uid", 0);
        boolean publish = call.getBoolean("publish", true);
        if (joining.getAndSet(true)) { call.reject("Agora join is already in progress", "AGORA_JOINING"); return; }
        joinGranted(call, channel, token, uid, publish);
    }

    private void joinGranted(PluginCall call, String channel, String token, int uid, boolean publish) {
        try {
            engine.setClientRole(publish ? Constants.CLIENT_ROLE_BROADCASTER : Constants.CLIENT_ROLE_AUDIENCE);
            ChannelMediaOptions options = new ChannelMediaOptions();
            options.clientRoleType = publish ? Constants.CLIENT_ROLE_BROADCASTER : Constants.CLIENT_ROLE_AUDIENCE;
            options.publishMicrophoneTrack = publish; options.autoSubscribeAudio = true; options.autoSubscribeVideo = false;
            int result = engine.joinChannel(token, channel, uid, options);
            if (result != 0) { joining.set(false); call.reject("Agora joinChannel failed: " + result, "AGORA_JOIN_FAILED"); return; }
            JSObject out = new JSObject(); out.put("accepted", true); out.put("channel", channel); out.put("uid", uid); call.resolve(out);
        } catch (Exception e) { joining.set(false); call.reject("Agora join failed: " + e.getMessage(), "AGORA_JOIN_FAILED", e); }
    }

    @PluginMethod public void renewToken(PluginCall call) {
        if (engine == null) { call.reject("Agora is not initialized", "AGORA_NOT_INITIALIZED"); return; }
        String token = call.getString("token", "").trim();
        if (token.isEmpty()) { call.reject("A renewed Agora token is required", "AGORA_TOKEN_REQUIRED"); return; }
        int result = engine.renewToken(token);
        if (result != 0) { call.reject("Unable to renew Agora token: " + result, "AGORA_TOKEN_RENEW_FAILED"); return; }
        JSObject out = new JSObject(); out.put("renewed", true); call.resolve(out);
    }

    @PluginMethod public void setMuted(PluginCall call) {
        if (engine == null) { call.reject("Agora is not initialized"); return; }
        boolean muted = call.getBoolean("muted", true); int result = engine.muteLocalAudioStream(muted);
        if (result != 0) { call.reject("Unable to change microphone state: " + result); return; }
        JSObject out = new JSObject(); out.put("muted", muted); call.resolve(out);
    }
    @PluginMethod public void setCanPublish(PluginCall call) {
        if (engine == null) { call.reject("Agora is not initialized"); return; }
        boolean enabled = call.getBoolean("enabled", false);
        if (enabled && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("microphone", call, "publishAfterMicrophonePermission");
            return;
        }
        applyCanPublish(call, enabled);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void publishAfterMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Microphone permission is required to speak in the Party Room", "MIC_PERMISSION_REQUIRED");
            return;
        }
        applyCanPublish(call, true);
    }

    private void applyCanPublish(PluginCall call, boolean enabled) {
        if (engine == null) { call.reject("Agora is not initialized"); return; }
        int result = engine.setClientRole(enabled ? Constants.CLIENT_ROLE_BROADCASTER : Constants.CLIENT_ROLE_AUDIENCE);
        if (result != 0) { call.reject("Unable to change Agora role: " + result); return; }
        ChannelMediaOptions options = new ChannelMediaOptions();
        options.clientRoleType = enabled ? Constants.CLIENT_ROLE_BROADCASTER : Constants.CLIENT_ROLE_AUDIENCE;
        options.publishMicrophoneTrack = enabled;
        options.autoSubscribeAudio = true;
        options.autoSubscribeVideo = false;
        int update = engine.updateChannelMediaOptions(options);
        if (update != 0) { call.reject("Unable to update Agora publishing: " + update); return; }
        JSObject out = new JSObject(); out.put("enabled", enabled); call.resolve(out);
    }
    @PluginMethod public void setSpeaker(PluginCall call) {
        if (engine == null) { call.reject("Agora is not initialized"); return; }
        boolean enabled = call.getBoolean("enabled", true); engine.setEnableSpeakerphone(enabled);
        JSObject out = new JSObject(); out.put("enabled", enabled); call.resolve(out);
    }
    @PluginMethod public void leave(PluginCall call) {
        joining.set(false);
        if (engine != null) { try { engine.stopPreview(); engine.leaveChannel(); } catch (Exception ignored) {} }
        currentChannel = null; localUid = 0; JSObject out = new JSObject(); out.put("left", true); call.resolve(out);
    }
    @PluginMethod public void destroy(PluginCall call) {
        joining.set(false);
        try { if (engine != null) { engine.leaveChannel(); RtcEngine.destroy(); } } catch (Exception ignored) {}
        engine = null; currentChannel = null; localUid = 0; JSObject out = new JSObject(); out.put("destroyed", true); call.resolve(out);
    }
    @Override protected void handleOnDestroy() {
        try { if (engine != null) { engine.leaveChannel(); RtcEngine.destroy(); } } catch (Exception ignored) {}
        engine = null; super.handleOnDestroy();
    }
}
