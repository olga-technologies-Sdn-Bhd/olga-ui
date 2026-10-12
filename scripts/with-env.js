// Runs a command with OLGA_ENV set, the same way on Windows, macOS and Linux.
// Usage: node scripts/with-env.js <dev|prod|local> <command...>
const { spawnSync } = require('child_process');

const [env, ...command] = process.argv.slice(2);
if (!['dev', 'prod', 'local'].includes(env) || command.length === 0) {
  console.error('Usage: node scripts/with-env.js <dev|prod|local> <command...>');
  process.exit(1);
}

const result = spawnSync(command.join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, OLGA_ENV: env },
});
process.exit(result.status ?? 1);
