import { spawnSync } from 'node:child_process';

const result = spawnSync('java', ['-version'], { encoding: 'utf-8' });
if (result.status === 0) {
  process.exit(0);
}

const stderr = result.stderr ? result.stderr.trim() : '';
const stdout = result.stdout ? result.stdout.trim() : '';
const details = stderr.length > 0 ? stderr : stdout;

console.error('Java runtime is required for Firestore Emulator tests.');
if (details.length > 0) {
  console.error(details);
}
console.error('Install Java 17+ and ensure `java` is available in PATH, then rerun `npm run rules:test`.');
process.exit(1);
