import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

interface TestCase {
  name: string;
  run: (testEnv: RulesTestEnvironment) => Promise<void>;
}

interface EmulatorHostPort {
  host: string;
  port: number;
}

type TestAuthContext = ReturnType<RulesTestEnvironment['authenticatedContext']>;
type TestUnauthContext = ReturnType<RulesTestEnvironment['unauthenticatedContext']>;
type TestFirestore = ReturnType<TestAuthContext['firestore']>;

const projectId = 'demo-rasoi-planner';
const ownerUid = 'owner-uid-1';
const ownerEmail = 'owner@example.com';
const cookUid = 'cook-uid-1';
const cookEmail = 'cook@example.com';
const intruderUid = 'intruder-uid-1';
const userAUid = 'legacy-user-a';
const userBUid = 'legacy-user-b';
const householdId = 'household-a';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function getAuthenticatedDb(testEnv: RulesTestEnvironment, uid: string, email: string): TestFirestore {
  return testEnv.authenticatedContext(uid, { email }).firestore();
}

function getUnauthenticatedDb(testEnv: RulesTestEnvironment): ReturnType<TestUnauthContext['firestore']> {
  return testEnv.unauthenticatedContext().firestore();
}

function parseEmulatorHostPort(rawHostPort: string): EmulatorHostPort {
  const parts = rawHostPort.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid FIRESTORE_EMULATOR_HOST value "${rawHostPort}". Expected "<host>:<port>".`);
  }

  const host = parts[0];
  const portValue = Number(parts[1]);
  if (!Number.isInteger(portValue) || portValue <= 0) {
    throw new Error(`Invalid emulator port "${parts[1]}" in FIRESTORE_EMULATOR_HOST.`);
  }

  return { host, port: portValue };
}

async function seedOwnerHousehold(testEnv: RulesTestEnvironment, cookEmailValue: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'households', householdId), {
      ownerId: ownerUid,
      cookEmail: cookEmailValue.toLowerCase(),
    });
  });
}

async function seedInventoryItem(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'households', householdId, 'inventory', 'tomatoes'), {
      name: 'Tomatoes',
      category: 'Vegetables',
      status: 'in-stock',
      icon: '🍅',
      lastUpdated: '2026-03-23T00:00:00.000Z',
      updatedBy: 'owner',
      defaultQuantity: '1kg',
      requestedQuantity: '',
      verificationNeeded: false,
      anomalyReason: '',
    });
  });
}

async function seedLogItem(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'households', householdId, 'logs', 'seed-log-1'), {
      itemId: 'tomatoes',
      itemName: 'Tomatoes',
      oldStatus: 'in-stock',
      newStatus: 'low',
      timestamp: '2026-03-23T09:00:00.000Z',
      role: 'owner',
    });
  });
}

async function testUnauthenticatedCannotReadOrWriteHousehold(testEnv: RulesTestEnvironment): Promise<void> {
  const unauthDb = getUnauthenticatedDb(testEnv);
  await assertFails(getDoc(doc(unauthDb, 'households', householdId)));
  await assertFails(
    setDoc(doc(unauthDb, 'households', 'new-household'), {
      ownerId: ownerUid,
      cookEmail: '',
    }),
  );
}

async function testOwnerCreateRequiresMatchingOwnerId(testEnv: RulesTestEnvironment): Promise<void> {
  const ownerDb = getAuthenticatedDb(testEnv, ownerUid, ownerEmail);
  await assertSucceeds(
    setDoc(doc(ownerDb, 'households', householdId), {
      ownerId: ownerUid,
      cookEmail: '',
    }),
  );

  await assertFails(
    setDoc(doc(ownerDb, 'households', 'household-owner-mismatch'), {
      ownerId: intruderUid,
      cookEmail: '',
    }),
  );
}

async function testNonOwnerCannotUpdateOrDeleteOwnerHousehold(testEnv: RulesTestEnvironment): Promise<void> {
  await seedOwnerHousehold(testEnv, cookEmail);
  const intruderDb = getAuthenticatedDb(testEnv, intruderUid, 'intruder@example.com');

  await assertFails(
    updateDoc(doc(intruderDb, 'households', householdId), {
      cookEmail: 'other@example.com',
    }),
  );
  await assertFails(deleteDoc(doc(intruderDb, 'households', householdId)));
}

async function testInvitedCookCanReadHouseholdInventoryAndLogs(testEnv: RulesTestEnvironment): Promise<void> {
  await seedOwnerHousehold(testEnv, cookEmail);
  await seedInventoryItem(testEnv);
  await seedLogItem(testEnv);

  const cookDb = getAuthenticatedDb(testEnv, cookUid, cookEmail);
  await assertSucceeds(getDoc(doc(cookDb, 'households', householdId)));
  await assertSucceeds(getDoc(doc(cookDb, 'households', householdId, 'inventory', 'tomatoes')));
  await assertSucceeds(getDocs(collection(cookDb, 'households', householdId, 'logs')));
}

async function testInvitedCookCannotWriteMealsOrDeleteInventory(testEnv: RulesTestEnvironment): Promise<void> {
  await seedOwnerHousehold(testEnv, cookEmail);
  await seedInventoryItem(testEnv);

  const cookDb = getAuthenticatedDb(testEnv, cookUid, cookEmail);
  await assertFails(
    setDoc(doc(cookDb, 'households', householdId, 'meals', '2026-03-23'), {
      morning: 'Poha',
      evening: 'Khichdi',
      notes: '',
      leftovers: '',
    }),
  );
  await assertFails(deleteDoc(doc(cookDb, 'households', householdId, 'inventory', 'tomatoes')));
}

async function testInventoryAndLogWritesEnforceRules(testEnv: RulesTestEnvironment): Promise<void> {
  await seedOwnerHousehold(testEnv, cookEmail);
  await seedInventoryItem(testEnv);

  const ownerDb = getAuthenticatedDb(testEnv, ownerUid, ownerEmail);
  const timestamp = '2026-03-23T10:00:00.000Z';
  const validBatch = writeBatch(ownerDb);
  validBatch.update(doc(ownerDb, 'households', householdId, 'inventory', 'tomatoes'), {
    status: 'low',
    lastUpdated: timestamp,
    updatedBy: 'owner',
    requestedQuantity: '2kg',
  });
  validBatch.set(doc(ownerDb, 'households', householdId, 'logs', 'log-valid-owner'), {
    itemId: 'tomatoes',
    itemName: 'Tomatoes',
    oldStatus: 'in-stock',
    newStatus: 'low',
    timestamp,
    role: 'owner',
  });
  await assertSucceeds(validBatch.commit());

  const invalidBatch = writeBatch(ownerDb);
  invalidBatch.update(doc(ownerDb, 'households', householdId, 'inventory', 'tomatoes'), {
    status: 'out',
    lastUpdated: '2026-03-23T10:05:00.000Z',
    updatedBy: 'owner',
  });
  invalidBatch.set(doc(ownerDb, 'households', householdId, 'logs', 'log-invalid-owner'), {
    itemId: 'tomatoes',
    itemName: 'Tomatoes',
    oldStatus: 'in-stock',
    newStatus: 'out',
    timestamp: '2026-03-23T10:05:00.000Z',
    role: 'owner',
  });
  await assertFails(invalidBatch.commit());
}

async function testLegacyUsersPathRestrictedByUid(testEnv: RulesTestEnvironment): Promise<void> {
  const userADb = getAuthenticatedDb(testEnv, userAUid, 'legacya@example.com');
  const userBDb = getAuthenticatedDb(testEnv, userBUid, 'legacyb@example.com');

  await assertSucceeds(
    setDoc(doc(userADb, 'users', userAUid), {
      profile: 'owner',
    }),
  );
  await assertSucceeds(
    setDoc(doc(userADb, 'users', userAUid, 'settings', 'main'), {
      theme: 'light',
    }),
  );

  await assertFails(getDoc(doc(userBDb, 'users', userAUid)));
  await assertFails(
    setDoc(doc(userBDb, 'users', userAUid, 'settings', 'main'), {
      theme: 'dark',
    }),
  );
}

async function executeTestCase(testEnv: RulesTestEnvironment, testCase: TestCase): Promise<void> {
  await testEnv.clearFirestore();
  try {
    await testCase.run(testEnv);
    console.log(`PASS: ${testCase.name}`);
  } catch (error) {
    throw new Error(`FAIL: ${testCase.name} -> ${toErrorMessage(error)}`);
  }
}

async function runAllTests(testEnv: RulesTestEnvironment): Promise<void> {
  const testCases: TestCase[] = [
    {
      name: 'Unauthenticated user cannot read/write household data',
      run: testUnauthenticatedCannotReadOrWriteHousehold,
    },
    {
      name: 'Owner can create household only when ownerId equals auth uid',
      run: testOwnerCreateRequiresMatchingOwnerId,
    },
    {
      name: 'Non-owner cannot update/delete owner household',
      run: testNonOwnerCannotUpdateOrDeleteOwnerHousehold,
    },
    {
      name: 'Invited cook can read household, inventory, and logs',
      run: testInvitedCookCanReadHouseholdInventoryAndLogs,
    },
    {
      name: 'Invited cook cannot write meals or delete inventory',
      run: testInvitedCookCannotWriteMealsOrDeleteInventory,
    },
    {
      name: 'Inventory/log writes must satisfy rules constraints',
      run: testInventoryAndLogWritesEnforceRules,
    },
    {
      name: 'Legacy users path is restricted by uid',
      run: testLegacyUsersPathRestrictedByUid,
    },
  ];

  for (const testCase of testCases) {
    await executeTestCase(testEnv, testCase);
  }
}

async function main(): Promise<void> {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error('FIRESTORE_EMULATOR_HOST is missing. Run via `firebase emulators:exec --only firestore`.');
  }

  const hostPort = parseEmulatorHostPort(emulatorHost);
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = await readFile(rulesPath, 'utf-8');
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: hostPort.host,
      port: hostPort.port,
      rules,
    },
  });

  try {
    await runAllTests(testEnv);
    console.log('All Firestore rules tests passed.');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error: unknown) => {
  console.error(toErrorMessage(error));
  process.exitCode = 1;
});
