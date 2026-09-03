const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const packagesRoot = path.resolve(monorepoRoot, 'packages');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Only watch shared packages — not the whole monorepo (api/admin/storage/node_modules).
config.watchFolders = [packagesRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Keep Metro from crawling other workspace apps and large binary storage.
config.resolver.blockList = [
  /[/\\]apps[/\\]api[/\\].*/,
  /[/\\]apps[/\\]admin[/\\].*/,
  /[/\\]apps[/\\]web[/\\].*/,
  /[/\\]apps[/\\]platform[/\\].*/,
  /[/\\]apps[/\\]api[/\\]storage[/\\].*/,
];

// Lower worker count avoids DataCloneError OOM on Windows during bundle serialization.
config.maxWorkers = 2;

module.exports = config;
