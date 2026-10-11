const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

// Which environment to bundle: OLGA_ENV = dev (default) | prod | local.
// src/config/environments/selected.ts is swapped for that environment's file,
// so the bundle holds one environment's values only.
const ENVIRONMENTS = ['dev', 'prod', 'local'];
const olgaEnv = process.env.OLGA_ENV || 'dev';
if (!ENVIRONMENTS.includes(olgaEnv)) {
  throw new Error(`OLGA_ENV must be one of ${ENVIRONMENTS.join(', ')} (got '${olgaEnv}')`);
}
const environmentsDir = path.join(__dirname, 'src', 'config', 'environments');
const selectedEnvironmentFile = path.join(environmentsDir, 'selected.ts');
const environmentFile = path.join(environmentsDir, `${olgaEnv}.ts`);

const config = {
  resolver: {
    // lucide-react-native ships its React Native build as .mjs files.
    sourceExts: [...defaultConfig.resolver.sourceExts, 'mjs'],
    resolveRequest: (context, moduleName, platform) => {
      const resolution = context.resolveRequest(context, moduleName, platform);
      if (resolution.type === 'sourceFile' && resolution.filePath === selectedEnvironmentFile) {
        return { ...resolution, filePath: environmentFile };
      }
      return resolution;
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
