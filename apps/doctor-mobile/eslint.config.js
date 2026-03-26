// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'react/react-in-jsx-scope': 'off', // JSX Transform doesn't require React import
      '@typescript-eslint/no-explicit-any': 'off', // Allow any type for compatibility layers
    },
  },
]);
