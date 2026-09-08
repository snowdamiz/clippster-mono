/**
 * Config plugin for @clippster/editor-native.
 * Autolinking handles the native module; this plugin documents provenance
 * and keeps a stable Expo plugin entry for app.config.ts.
 */
function withClippsterEditorNative(config) {
  return config;
}

module.exports = withClippsterEditorNative;
