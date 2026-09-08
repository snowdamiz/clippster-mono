const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Pin Android NDK for Expo prebuild.
 *
 * NDK 26's Clang fails to compile react-native-reanimated 4.3.x
 * (TransformOperationInterpolator ResolvableOp template redeclaration).
 * React Native 0.85 / local builds use NDK 27.x, which compiles cleanly.
 */
function withAndroidNdkVersion(config, props = {}) {
  const version = props.version ?? '27.1.12297006';

  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    if (/ndkVersion\s*=/.test(contents)) {
      contents = contents.replace(
        /ndkVersion\s*=\s*["'][^"']+["']/,
        `ndkVersion = "${version}"`,
      );
    } else {
      contents = contents.replace(
        /buildscript\s*\{/,
        `buildscript {\n    ext {\n        ndkVersion = "${version}"\n    }`,
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = withAndroidNdkVersion;
