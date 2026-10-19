// Makes an iOS archive for one environment and shows it in Xcode's Organizer.
//
// Usage: node scripts/archive-ios.js <dev|prod> [--no-open]
//   npm run ios:archive:dev    dev app   com.olga.dev.connect  profile Olga-Dev-AppStore
//   npm run ios:archive:prod   prod app  com.olga.connect      profile Olga-Prod
// (Product > Archive in Xcode does the same as ios:archive:prod.)
//
// When it finishes it prints what to do next and opens the archive in the Organizer,
// where you click Distribute App > App Store Connect > Upload.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const ENVIRONMENTS = {
  dev: {
    appName: 'Ol-ga Dev',
    bundleId: 'com.olga.dev.connect',
    profile: 'Olga-Dev-AppStore',
    settings: [
      'OLGA_BUNDLE_ENV=dev',
      'OLGA_BUNDLE_ID=com.olga.dev.connect',
      'OLGA_AUTH_SCHEME=olga-dev',
      'OLGA_LINK_SCHEME=olgaapp-dev',
      'OLGA_NAME_SUFFIX= Dev',
      'OLGA_PROFILE=Olga-Dev-AppStore',
    ],
  },
  prod: {
    appName: 'Ol-ga',
    bundleId: 'com.olga.connect',
    profile: 'Olga-Prod',
    settings: [
      'OLGA_BUNDLE_ENV=prod',
      'OLGA_BUNDLE_ID=com.olga.connect',
      'OLGA_AUTH_SCHEME=olga',
      'OLGA_LINK_SCHEME=olgaapp',
      'OLGA_NAME_SUFFIX=',
      'OLGA_PROFILE=Olga-Prod',
    ],
  },
};

const args = process.argv.slice(2);
const envName = args.find((a) => !a.startsWith('--'));
const env = ENVIRONMENTS[envName];
if (!env) {
  console.error('Usage: node scripts/archive-ios.js <dev|prod> [--no-open]');
  process.exit(1);
}
if (process.platform !== 'darwin') {
  console.error('Archiving an iOS app needs a Mac with Xcode.');
  process.exit(1);
}

const line = '='.repeat(62);
const fail = (message) => {
  console.error(`\n${line}\n  ARCHIVE NOT STARTED (${envName})\n${line}\n  ${message}\n`);
  process.exit(1);
};

// 1) Checks, so a missing profile or certificate is explained before a long build.
function profileInstalled(name) {
  const dirs = [
    path.join(os.homedir(), 'Library/Developer/Xcode/UserData/Provisioning Profiles'),
    path.join(os.homedir(), 'Library/MobileDevice/Provisioning Profiles'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.mobileprovision'))) {
      const decoded = spawnSync('security', ['cms', '-D', '-i', path.join(dir, file)], { encoding: 'utf8' });
      if (decoded.status !== 0) continue;
      const nameOut = spawnSync('plutil', ['-extract', 'Name', 'raw', '-'], { input: decoded.stdout, encoding: 'utf8' });
      if (nameOut.stdout.trim() === name) return true;
    }
  }
  return false;
}
if (!profileInstalled(env.profile)) {
  fail(
    `The provisioning profile "${env.profile}" is not installed on this Mac.\n` +
      `  Download it from developer.apple.com (Profiles) and double-click it, then run this again.`
  );
}
const identities = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' }).stdout || '';
if (!/Apple Distribution/.test(identities)) {
  fail(
    'No "Apple Distribution" certificate with its private key is installed on this Mac.\n' +
      '  Import the shared .p12 file (double-click it), then run this again.'
  );
}

// 2) Where the archive goes: Xcode's own folder, so the Organizer lists it.
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const hour12 = now.getHours() % 12 || 12;
const stamp =
  `${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${String(now.getFullYear()).slice(2)}, ` +
  `${hour12}.${pad(now.getMinutes())} ${now.getHours() < 12 ? 'AM' : 'PM'}`;
const archiveDir = path.join(os.homedir(), 'Library/Developer/Xcode/Archives', day);
fs.mkdirSync(archiveDir, { recursive: true });
const archivePath = path.join(archiveDir, `OlgaMobile ${envName === 'dev' ? 'Dev' : 'Prod'} ${stamp}.xcarchive`);
const logPath = path.join(os.tmpdir(), `olga-archive-${envName}.log`);

const xcodebuildArgs = [
  '-workspace', 'ios/OlgaMobile.xcworkspace',
  '-scheme', 'OlgaMobile',
  '-configuration', 'Release',
  '-destination', 'generic/platform=iOS',
  '-archivePath', archivePath,
  'archive',
  ...env.settings,
];

console.log(`\n${line}\n  Archiving ${env.appName} (${envName})\n${line}`);
console.log(`  App ID  : ${env.bundleId}`);
console.log(`  Profile : ${env.profile}`);
console.log(`  Servers : ${envName}`);
console.log(`  Log     : ${logPath}`);
console.log('\n  This takes several minutes. Working');

// 3) Build, with a dot every 20 seconds instead of thousands of lines.
const log = fs.openSync(logPath, 'w');
const child = spawn('xcodebuild', xcodebuildArgs, { cwd: root, stdio: ['ignore', log, log] });
const ticker = setInterval(() => process.stdout.write('.'), 20000);
child.on('exit', (code) => {
  clearInterval(ticker);
  fs.closeSync(log);
  console.log('');
  if (code !== 0) {
    const text = fs.readFileSync(logPath, 'utf8').split('\n');
    const errors = text.filter((l) => /error:/.test(l)).slice(-8);
    console.error(`\n${line}\n  ARCHIVE FAILED (${envName})\n${line}`);
    console.error((errors.length ? errors : text.slice(-12)).map((l) => `  ${l}`).join('\n'));
    console.error(`\n  Full log: ${logPath}\n`);
    process.exit(code || 1);
  }
  const plist = path.join(archivePath, 'Info.plist');
  const read = (key) =>
    spawnSync('/usr/libexec/PlistBuddy', ['-c', `Print :ApplicationProperties:${key}`, plist], { encoding: 'utf8' }).stdout.trim();
  const version = `${read('CFBundleShortVersionString')} (${read('CFBundleVersion')})`;
  const signed = read('SigningIdentity');

  console.log(`\n${line}`);
  console.log(`  ARCHIVE COMPLETE  (${envName})`);
  console.log(line);
  console.log(`  App      : ${env.appName}  ${env.bundleId}`);
  console.log(`  Version  : ${version}   (each upload needs a new build number)`);
  console.log(`  Signed   : ${signed}`);
  console.log(`  Servers  : ${envName}`);
  console.log('\n  NEXT: go to the Xcode Organizer to upload it');
  console.log('    1. In Xcode choose Window > Organizer (it opens now)');
  console.log('    2. Pick this archive, then click Distribute App');
  console.log('    3. Choose App Store Connect > Upload');
  console.log(`    4. If asked for a profile, choose ${env.profile}`);
  console.log(`\n  Archive: ${archivePath}\n`);
  if (!args.includes('--no-open')) spawnSync('open', [archivePath]);
});
process.on('SIGINT', () => (child.kill('SIGINT'), process.exit(130)));
