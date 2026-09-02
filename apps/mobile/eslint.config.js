const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/', '.expo/', 'android/', 'ios/'],
  },
  {
    // React Compiler rules from eslint-plugin-react-hooks@7 false-positive heavily
    // on Reanimated shared values and common RN data-loading effects.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
