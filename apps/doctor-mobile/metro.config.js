// Expo SDK 52+ configures pnpm/yarn monorepos automatically (watchFolders,
// nodeModulesPaths, symlinks). We only add what this repo needs on top.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Keep Expo's defaults and make sure the whole workspace is watched.
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), workspaceRoot]));

// In a pnpm monorepo, packages may be hoisted to workspace root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Some dependencies ship broken "exports" maps under Metro.
config.resolver.unstable_enablePackageExports = false;

// Resolve the shared workspace packages straight from source.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@smileguard/shared-types': path.resolve(workspaceRoot, 'packages/shared-types'),
  '@smileguard/shared-hooks': path.resolve(workspaceRoot, 'packages/shared-hooks'),
  '@smileguard/supabase-client': path.resolve(workspaceRoot, 'packages/supabase-client'),
};

module.exports = config;
