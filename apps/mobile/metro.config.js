const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Skia's useSVG loads SVG files as static assets.
if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts.push('svg');
}

// Yarn workspaces hoist packages to the monorepo root — Metro must search both trees.
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Windows junction-safe fallbacks for workspace packages.
const workspacePackages = {
  '@clippster/api-client': path.resolve(monorepoRoot, 'packages/api-client'),
  '@clippster/clip-export': path.resolve(monorepoRoot, 'packages/clip-export'),
  '@clippster/cloud-sync-schema': path.resolve(monorepoRoot, 'packages/cloud-sync-schema'),
  '@clippster/shared-types': path.resolve(monorepoRoot, 'packages/shared-types'),
  '@clippster/sqlite-schema': path.resolve(monorepoRoot, 'packages/sqlite-schema'),
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...workspacePackages,
};

// Web preview stubs: native modules that break Expo web bundling/runtime.
const webStubs = {
  'expo-sqlite': path.resolve(projectRoot, 'src/mocks/expo-sqlite.web.ts'),
  'expo-secure-store': path.resolve(projectRoot, 'src/mocks/expo-secure-store.web.ts'),
};
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const stub =
      webStubs[moduleName] ??
      Object.entries(webStubs).find(([name]) => moduleName.startsWith(`${name}/`))?.[1];
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