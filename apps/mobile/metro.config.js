const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const config = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
const resolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Browser UI previews use the existing adapter without SQLite's WASM worker.
  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/mocks/expo-sqlite.web.ts'),
    };
  }
  if (platform === 'web' && moduleName === 'expo-secure-store') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'src/mocks/expo-secure-store.web.ts'),
    };
  }

  return resolveRequest
    ? resolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
