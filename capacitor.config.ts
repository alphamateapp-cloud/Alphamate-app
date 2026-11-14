import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alphamate.liveparty',
  appName: 'Alpha Mate',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#09070F',
    buildOptions: {
      keystorePath: 'release-key.jks',
      keystoreAlias: 'alphamate',
    },
  },
  plugins: {
    FirebaseAuthentication: {
      // Use the native Android Google account chooser and Firebase SDK.
      // The web Firebase JS SDK session is synchronized after native sign-in.
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#09070F',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
