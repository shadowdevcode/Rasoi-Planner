import { spawnSync } from 'node:child_process';

const MIN_JAVA_MAJOR = 21;

function extractMajorVersion(output) {
  const match = output.match(/version\s+"([^"]+)"/i);
  if (!match) {
    return null;
  }

  const versionString = match[1];
  const firstSegment = versionString.split('.')[0];
  if (firstSegment === '1') {
    const legacySegment = versionString.split('.')[1];
    if (!legacySegment) {
      return null;
    }
    const parsedLegacy = Number.parseInt(legacySegment, 10);
    return Number.isNaN(parsedLegacy) ? null : parsedLegacy;
  }

  const parsed = Number.parseInt(firstSegment, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

const result = spawnSync('java', ['-version'], { encoding: 'utf-8' });
const stderr = result.stderr ? result.stderr.trim() : '';
const stdout = result.stdout ? result.stdout.trim() : '';
const details = stderr.length > 0 ? stderr : stdout;

if (result.status !== 0) {
  console.error('Java runtime is required for Firestore Emulator tests.');
  if (details.length > 0) {
    console.error(details);
  }
  console.error(`Install Java ${MIN_JAVA_MAJOR}+ and ensure \`java\` is available in PATH, then rerun \`npm run rules:test\`.`);
  process.exit(1);
}

const majorVersion = extractMajorVersion(details);
if (majorVersion === null) {
  console.error('Unable to detect Java major version from `java -version` output.');
  console.error(details);
  console.error(`Install Java ${MIN_JAVA_MAJOR}+ and ensure \`java\` is available in PATH, then rerun \`npm run rules:test\`.`);
  process.exit(1);
}

if (majorVersion < MIN_JAVA_MAJOR) {
  console.error(`Java ${MIN_JAVA_MAJOR}+ is required for Firestore Emulator tests.`);
  console.error(`Detected Java major version: ${majorVersion}`);
  console.error(details);
  console.error(`Install Java ${MIN_JAVA_MAJOR}+ and ensure \`java\` is available in PATH, then rerun \`npm run rules:test\`.`);
  process.exit(1);
}

process.exit(0);
