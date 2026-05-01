const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo
config.watchFolders = [workspaceRoot];

// Let pnpm symlinks resolve naturally — no manual extraNodeModules needed
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Remove the old workarounds that are causing doctor warnings:
// - disableHierarchicalLookup: true  → causes duplicate native module detection
// - unstable_enableSymlinks: true    → no longer needed in Expo 54, enabled by default
// - extraNodeModules manual map      → pnpm symlinks handle this now

module.exports = config;