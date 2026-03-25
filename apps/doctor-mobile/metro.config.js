const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = false; // ← disables broken exports field

config.resolver.extraNodeModules = {
  '@smileguard/shared-types': path.resolve(workspaceRoot, 'packages/shared-types'),
  '@smileguard/shared-hooks': path.resolve(workspaceRoot, 'packages/shared-hooks'),
  '@smileguard/supabase-client': path.resolve(workspaceRoot, 'packages/supabase-client'),
};

module.exports = config;