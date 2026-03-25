import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function getFirestoreTargets(firebaseConfig) {
  const firestoreConfig = firebaseConfig.firestore;
  if (Array.isArray(firestoreConfig)) {
    return firestoreConfig;
  }

  if (firestoreConfig && typeof firestoreConfig === 'object') {
    return [{ database: '(default)', ...firestoreConfig }];
  }

  return [];
}

async function main() {
  const rootDir = process.cwd();
  const appConfigPath = path.join(rootDir, 'firebase-applet-config.json');
  const firebaseJsonPath = path.join(rootDir, 'firebase.json');

  const appConfig = await readJsonFile(appConfigPath);
  const firebaseConfig = await readJsonFile(firebaseJsonPath);

  const projectId = String(appConfig.projectId ?? '').trim();
  const databaseId = String(appConfig.firestoreDatabaseId ?? '').trim();
  const targets = getFirestoreTargets(firebaseConfig);
  const databases = targets
    .map((target) => String(target.database ?? '').trim())
    .filter((value) => value.length > 0);

  const hasDefaultTarget = databases.includes('(default)');
  const hasNamedTarget = databases.includes(databaseId);

  console.log('Firestore deploy target verification');
  console.log(`- projectId: ${projectId}`);
  console.log(`- app databaseId: ${databaseId}`);
  console.log(`- firebase.json targets: ${databases.join(', ') || '(none)'}`);
  console.log('- recommended deploy command:');
  console.log(`  npx firebase deploy --only firestore:rules --project ${projectId}`);

  if (!hasDefaultTarget || !hasNamedTarget) {
    console.error('Firestore target mismatch detected in firebase.json.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Failed to verify Firestore deploy targets.', error);
  process.exitCode = 1;
});
