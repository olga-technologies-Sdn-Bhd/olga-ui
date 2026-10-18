// Runs the app on a phone, simulator or emulator for ONE environment, together
// with a Metro server for that same environment, so the JavaScript, the app ID
// and the sign-in redirect always belong to the same environment.
//
// Usage: node scripts/run-app.js <ios|android> <dev|prod> [--dry-run] [extra run options]
//   npm run ios:dev      npm run ios:prod
//   npm run android:dev  npm run android:prod
// Extra options go to `react-native run-ios` / `run-android`, for example
//   npm run ios:dev -- --device "My iPhone"      npm run ios:prod -- --simulator "iPhone 17"
//
// Local overrides for iOS (not committed), for a developer who has to sign with
// a team other than the project's: OLGA_IOS_TEAM=<team id>, OLGA_IOS_BUNDLE_ID=<id>.
// These commands do not let Xcode create profiles, certificates or devices in the Apple
// account (no -allowProvisioningUpdates). Set OLGA_IOS_ALLOW_PROVISIONING=1 to allow it.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
const rnCli = path.join(root, 'node_modules', 'react-native', 'cli.js');
const METRO_PORT = 8081;

const ENVIRONMENTS = {
  dev: {
    ios: ['OLGA_AUTH_SCHEME=olga-dev', 'OLGA_BUNDLE_ID=com.olga.dev.connect'],
    androidAppId: 'com.olga.connect.dev',
  },
  prod: {
    ios: ['OLGA_AUTH_SCHEME=olga', 'OLGA_BUNDLE_ID=com.olga.connect', 'OLGA_NAME_SUFFIX='],
    androidAppId: 'com.olga.connect',
  },
};

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const [platform, envName, ...rest] = argv.filter((a) => a !== '--dry-run');
if (!['ios', 'android'].includes(platform) || !ENVIRONMENTS[envName]) {
  console.error('Usage: node scripts/run-app.js <ios|android> <dev|prod> [--dry-run] [extra run options]');
  process.exit(1);
}

function iosParams() {
  // Never let a run command create profiles, certificates or devices in the Apple account.
  // Opt in on purpose with OLGA_IOS_ALLOW_PROVISIONING=1.
  const params = [...(process.env.OLGA_IOS_ALLOW_PROVISIONING === '1' ? ['-allowProvisioningUpdates'] : []), ...ENVIRONMENTS[envName].ios];
  const bundleId = process.env.OLGA_IOS_BUNDLE_ID;
  if (bundleId) {
    params[params.findIndex((p) => p.startsWith('OLGA_BUNDLE_ID='))] = `OLGA_BUNDLE_ID=${bundleId}`;
  }
  if (process.env.OLGA_IOS_TEAM) params.push(`DEVELOPMENT_TEAM=${process.env.OLGA_IOS_TEAM}`);
  return params;
}

const buildArgs =
  platform === 'ios'
    ? [rnCli, 'run-ios', '--no-packager', '--mode', 'Debug', '--extra-params', iosParams().join(' '), ...rest]
    : [rnCli, 'run-android', '--no-packager', '--appId', ENVIRONMENTS[envName].androidAppId, ...rest];
const metroArgs = [rnCli, 'start'];
const childEnv = { ...process.env, OLGA_ENV: envName };

console.log(`\nOLGA_ENV=${envName}  platform=${platform}`);
console.log(`Metro : node ${path.relative(root, rnCli)} start`);
console.log(`Build : node ${path.relative(root, rnCli)} ${buildArgs.slice(1).map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}\n`);
if (dryRun) process.exit(0);

function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect(METRO_PORT, '127.0.0.1');
    socket.on('connect', () => (socket.destroy(), resolve(true)));
    socket.on('error', () => resolve(false));
  });
}

function metroReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const poll = () => {
      http
        .get({ host: '127.0.0.1', port: METRO_PORT, path: '/status', timeout: 2000 }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => (body.includes('running') ? resolve(true) : retry()));
        })
        .on('error', retry);
    };
    const retry = () => (Date.now() > deadline ? resolve(false) : setTimeout(poll, 1000));
    poll();
  });
}

(async () => {
  if (await portInUse()) {
    console.error(
      `Metro (or something else) is already using port ${METRO_PORT}. Stop it first (Ctrl+C in its terminal), ` +
        `so this app gets the ${envName} bundle.`
    );
    process.exit(1);
  }
  const metro = spawn(process.execPath, metroArgs, { cwd: root, env: childEnv, stdio: 'inherit' });
  const stop = () => metro.killed || metro.kill();
  process.on('SIGINT', () => (stop(), process.exit(0)));
  process.on('SIGTERM', () => (stop(), process.exit(0)));
  metro.on('exit', (code) => process.exit(code ?? 0));

  if (!(await metroReady(90000))) {
    console.error('Metro did not start in time.');
    stop();
    process.exit(1);
  }
  const build = spawn(process.execPath, buildArgs, { cwd: root, env: childEnv, stdio: 'inherit' });
  build.on('exit', (code) => {
    if (code) {
      stop();
      process.exit(code);
    }
    console.log(`\nApp is running on ${envName}. Metro (${envName}) stays up here; press Ctrl+C to stop it.`);
  });
})();
