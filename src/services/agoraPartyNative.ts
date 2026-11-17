import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface AgoraPartyNativePlugin {
  initialize(options: { appId: string }): Promise<{ initialized: boolean }>;
  join(options: { channel: string; token: string; uid: number; publish: boolean }): Promise<{ accepted: boolean; channel: string; uid: number }>;
  setMuted(options: { muted: boolean }): Promise<{ muted: boolean }>;
  setCanPublish(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  renewToken(options: { token: string }): Promise<{ renewed: boolean }>;
  setSpeaker(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  leave(): Promise<{ left: boolean }>;
  destroy(): Promise<{ destroyed: boolean }>;
  addListener(eventName: 'joined' | 'userJoined' | 'userOffline' | 'connectionState' | 'audioVolume' | 'error', listenerFunc: (event: any) => void): Promise<PluginListenerHandle>;
}

const NativeAgoraParty = registerPlugin<AgoraPartyNativePlugin>('AgoraParty');

export const agoraPartyNative = {
  isAvailable: () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
  initialize: (appId: string) => NativeAgoraParty.initialize({ appId }),
  join: (channel: string, token: string, uid: number, publish: boolean) =>
    NativeAgoraParty.join({ channel, token, uid, publish }),
  setMuted: (muted: boolean) => NativeAgoraParty.setMuted({ muted }),
  setCanPublish: (enabled: boolean) => NativeAgoraParty.setCanPublish({ enabled }),
  renewToken: (token: string) => NativeAgoraParty.renewToken({ token }),
  setSpeaker: (enabled: boolean) => NativeAgoraParty.setSpeaker({ enabled }),
  leave: () => NativeAgoraParty.leave(),
  destroy: () => NativeAgoraParty.destroy(),
  addListener: NativeAgoraParty.addListener.bind(NativeAgoraParty),
};
