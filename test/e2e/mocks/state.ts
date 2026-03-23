import type { InventoryItem, MealPlan, PantryLog } from '../../../src/types';
import { getLocalDateKey } from '../../../src/utils/date';

const DB_KEY = 'rasoi:e2e:db';
const USER_KEY = 'rasoi:e2e:user';

interface MockDatabase {
  counters: {
    doc: number;
  };
  documents: Record<string, Record<string, unknown>>;
}

interface MockUser {
  displayName: string;
  email: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  photoURL: string | null;
  providerData: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    providerId: string;
  }[];
  tenantId: null;
  uid: string;
}

const E2E_HOUSEHOLD_ID = 'household-e2e';

function buildInitialInventory(): InventoryItem[] {
  return [
    { id: '1', name: 'Turmeric (Haldi)', nameHi: 'हल्दी', category: 'Spices', status: 'in-stock', icon: '🟡', defaultQuantity: '200g', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '2', name: 'Red Chilli Powder', nameHi: 'लाल मिर्च', category: 'Spices', status: 'in-stock', icon: '🌶️', defaultQuantity: '200g', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '3', name: 'Garam Masala', nameHi: 'गरम मसाला', category: 'Spices', status: 'in-stock', icon: '🧆', defaultQuantity: '100g', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '4', name: 'Toor Dal', nameHi: 'तूर दाल', category: 'Pulses', status: 'in-stock', icon: '🥣', defaultQuantity: '1kg', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '5', name: 'Basmati Rice', nameHi: 'चावल', category: 'Staples', status: 'in-stock', icon: '🍚', defaultQuantity: '5kg', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '6', name: 'Atta (Wheat Flour)', nameHi: 'आटा', category: 'Staples', status: 'low', icon: '🌾', defaultQuantity: '5kg', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '7', name: 'Mustard Oil', nameHi: 'सरसों का तेल', category: 'Staples', status: 'in-stock', icon: '🛢️', defaultQuantity: '1L', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '8', name: 'Onions', nameHi: 'प्याज', category: 'Veggies', status: 'in-stock', icon: '🧅', defaultQuantity: '2kg', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '9', name: 'Tomatoes', nameHi: 'टमाटर', category: 'Veggies', status: 'out', icon: '🍅', defaultQuantity: '1kg', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
    { id: '10', name: 'Milk', nameHi: 'दूध', category: 'Dairy', status: 'in-stock', icon: '🥛', defaultQuantity: '1L', updatedBy: 'owner', lastUpdated: '2026-03-20T08:00:00.000Z' },
  ];
}

function buildInitialMeals(): Record<string, MealPlan> {
  const today = getLocalDateKey(new Date());
  return {
    [today]: {
      morning: 'Aloo Paratha, Curd, Pickle',
      evening: 'Dal Tadka, Jeera Rice, Bhindi Fry',
      notes: 'Make parathas less spicy for kids.',
      leftovers: "Use yesterday's leftover dal for paratha dough.",
    },
  };
}

function buildSeedDatabase(): MockDatabase {
  const documents: Record<string, Record<string, unknown>> = {
    [`households/${E2E_HOUSEHOLD_ID}`]: {
      ownerId: 'owner-1',
      cookEmail: 'cook@example.com',
    },
  };

  buildInitialInventory().forEach((item) => {
    documents[`households/${E2E_HOUSEHOLD_ID}/inventory/${item.id}`] = item as unknown as Record<string, unknown>;
  });

  Object.entries(buildInitialMeals()).forEach(([dateKey, meal]) => {
    documents[`households/${E2E_HOUSEHOLD_ID}/meals/${dateKey}`] = meal as unknown as Record<string, unknown>;
  });

  return {
    counters: { doc: 100 },
    documents,
  };
}

function parseJson<T>(rawValue: string | null): T | null {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.warn('e2e_mock_json_parse_failed', { error });
    return null;
  }
}

function ensureWindow(): Window {
  if (typeof window === 'undefined') {
    throw new Error('E2E mocks require a browser environment.');
  }
  return window;
}

export function getDatabase(): MockDatabase {
  const browserWindow = ensureWindow();
  const existing = parseJson<MockDatabase>(browserWindow.localStorage.getItem(DB_KEY));
  if (existing) {
    return existing;
  }

  const seeded = buildSeedDatabase();
  browserWindow.localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveDatabase(nextDatabase: MockDatabase): void {
  const browserWindow = ensureWindow();
  browserWindow.localStorage.setItem(DB_KEY, JSON.stringify(nextDatabase));
}

export function resetDatabase(): MockDatabase {
  const seeded = buildSeedDatabase();
  saveDatabase(seeded);
  return seeded;
}

export function nextGeneratedId(): string {
  const database = getDatabase();
  const nextValue = database.counters.doc + 1;
  const nextDatabase: MockDatabase = {
    ...database,
    counters: {
      doc: nextValue,
    },
  };
  saveDatabase(nextDatabase);
  return `mock-${nextValue}`;
}

export function listCollectionDocuments(collectionPath: string): { id: string; path: string; data: Record<string, unknown> }[] {
  const prefix = `${collectionPath}/`;
  return Object.entries(getDatabase().documents)
    .filter(([path]) => path.startsWith(prefix))
    .filter(([path]) => !path.slice(prefix.length).includes('/'))
    .map(([path, data]) => ({
      id: path.slice(prefix.length),
      path,
      data,
    }));
}

export function getDocument(path: string): Record<string, unknown> | null {
  return getDatabase().documents[path] ?? null;
}

export function setDocument(path: string, value: Record<string, unknown>): void {
  const database = getDatabase();
  const nextDatabase: MockDatabase = {
    ...database,
    documents: {
      ...database.documents,
      [path]: value,
    },
  };
  saveDatabase(nextDatabase);
}

export function updateDocument(path: string, patch: Record<string, unknown>): void {
  const current = getDocument(path);
  if (!current) {
    throw new Error(`Document not found for update: ${path}`);
  }
  setDocument(path, {
    ...current,
    ...patch,
  });
}

export function deleteDocument(path: string): void {
  const database = getDatabase();
  const nextDocuments = { ...database.documents };
  delete nextDocuments[path];
  saveDatabase({
    ...database,
    documents: nextDocuments,
  });
}

export function getSignedInUser(): MockUser | null {
  return parseJson<MockUser>(ensureWindow().localStorage.getItem(USER_KEY));
}

export function saveSignedInUser(user: MockUser | null): void {
  const browserWindow = ensureWindow();
  if (user) {
    browserWindow.localStorage.setItem(USER_KEY, JSON.stringify(user));
    return;
  }
  browserWindow.localStorage.removeItem(USER_KEY);
}

export function resolveRequestedRole(): 'owner' | 'cook' {
  const browserWindow = ensureWindow();
  const role = new URL(browserWindow.location.href).searchParams.get('e2e-role');
  return role === 'cook' ? 'cook' : 'owner';
}

export function createMockUser(role: 'owner' | 'cook'): MockUser {
  if (role === 'cook') {
    return {
      uid: 'cook-1',
      email: 'cook@example.com',
      displayName: 'Cook User',
      photoURL: null,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [
        {
          providerId: 'google.com',
          displayName: 'Cook User',
          email: 'cook@example.com',
          photoURL: null,
        },
      ],
    };
  }

  return {
    uid: 'owner-1',
    email: 'owner@example.com',
    displayName: 'Owner User',
    photoURL: null,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [
      {
        providerId: 'google.com',
        displayName: 'Owner User',
        email: 'owner@example.com',
        photoURL: null,
      },
    ],
  };
}

export function resetAllState(): void {
  resetDatabase();
  saveSignedInUser(null);
}

export function appendLog(log: PantryLog): void {
  setDocument(`households/${E2E_HOUSEHOLD_ID}/logs/${log.id}`, log as unknown as Record<string, unknown>);
}

export function getHouseholdId(): string {
  return E2E_HOUSEHOLD_ID;
}
