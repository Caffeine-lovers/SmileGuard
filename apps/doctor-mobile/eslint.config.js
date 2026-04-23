// https://docs.expo.dev/guides/using-eslint/
// Minimal ESLint config - TypeScript support requires additional dependencies

module.exports = [
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      '.expo-shared/*',
      'build/*',
      '.gradle/*',
      'android/*',
      'ios/*',
    ],
  },
];

