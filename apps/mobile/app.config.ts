import type { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'Clippster Dev' : 'Clippster',
  slug: 'clippster',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'clippster',
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.clippster.mobile',
    buildNumber: '1',
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'Clippster needs photo library access to import videos and save exported clips.',
      NSPhotoLibraryAddUsageDescription:
        'Clippster saves exported clips to your photo library when you choose Save.',
      NSCameraUsageDescription: 'Clippster can import videos you capture for clipping.',
      NSMicrophoneUsageDescription: 'Clippster may access the microphone when importing recorded video.',
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
    },
  },
  android: {
    package: 'app.clippster.mobile',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#0a0a0b',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    permissions: [
      'READ_MEDIA_VIDEO',
      'READ_MEDIA_IMAGES',
      'INTERNET',
      'ACCESS_NETWORK_STATE',
    ],
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0a0a0b',
      },
    ],
    [
      'ffmpeg-expo',
      {
        enableDecoders: ['h264', 'hevc', 'aac', 'mp3'],
        enableEncoders: ['aac', 'libx264'],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Clippster needs photo library access to import videos for clipping.',
        cameraPermission: 'Clippster can import videos you capture for clipping.',
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission:
          'Clippster needs photo library access to save exported clips.',
        savePhotosPermission: 'Clippster saves exported clips to your photo library.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'clippster',
        project: process.env.SENTRY_PROJECT ?? 'clippster-mobile',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'ccd1a52f-5004-4490-9dc1-78731281fe6a',
    },
    privacyPolicyUrl: 'https://clippster.app/privacy',
    termsOfServiceUrl: 'https://clippster.app/terms',
  },
  owner: 'clippster',
});
