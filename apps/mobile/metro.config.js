const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Web preview stubs: native modules that break Expo web bundling/runtime.
const webStubs = {
  'expo-sqlite': path.resolve(projectRoot, 'src/mocks/expo-sqlite.web.ts'),
  'expo-secure-store': path.resolve(projectRoot, 'src/mocks/expo-secure-store.web.ts'),
};
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const stub = webStubs[moduleName] ?? Object.entries(webStubs).find(([name]) => moduleName.startsWith(`${name}/`))?.[1];
    if (stub) {
      return { filePath: stub, type: 'sourceFile' };
    }
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
