import {
  Firestore,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { InventoryItem, InventoryStatus, Role, UnknownIngredientQueueItem } from '../types';
import { sanitizeFirestorePayload } from '../utils/firestorePayload';
import { generateId } from '../utils/id';
import { resolveIngredientVisual } from '../utils/ingredientVisuals';
import { normalizePantryCategory } from '../utils/pantryCategory';
import { buildPantryLog } from './logService';

interface UpdateInventoryWithLogInput {
  db: Firestore;
  householdId: string;
  item: InventoryItem;
  newStatus: InventoryStatus;
  role: Role;
  requestedQuantity?: string;
}

interface AddUnlistedItemWithLogInput {
  db: Firestore;
  householdId: string;
  name: string;
  status: InventoryStatus;
  category: string;
  requestedQuantity?: string;
  role: Role;
}

interface QueueUnknownIngredientInput {
  db: Firestore;
  householdId: string;
  name: string;
  status: InventoryStatus;
  category: string;
  requestedQuantity?: string;
  role: Role;
}

interface ResolveUnknownIngredientQueueItemInput {
  db: Firestore;
  householdId: string;
  queueItem: UnknownIngredientQueueItem;
  role: Role;
}

function getResolvedNameHi(currentNameHi: string | undefined, resolvedNativeName: string | undefined): string | undefined {
  if (typeof currentNameHi === 'string' && currentNameHi.trim().length > 0) {
    return currentNameHi;
  }

  return resolvedNativeName;
}

function getInventoryAnomaly(item: InventoryItem, nextStatus: InventoryStatus): { verificationNeeded: boolean; anomalyReason?: string } {
  if (nextStatus !== 'out' || !item.lastUpdated || item.status !== 'in-stock') {
    return { verificationNeeded: false };
  }

  const previousDate = new Date(item.lastUpdated);
  const nowDate = new Date();
  const dayDifference = (nowDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);

  if (dayDifference < 2) {
    return {
      verificationNeeded: true,
      anomalyReason: `Marked finished unusually fast (in ${Math.round(dayDifference * 10) / 10} days).`,
    };
  }
  return { verificationNeeded: false };
}

export async function updateInventoryStatusWithLog(input: UpdateInventoryWithLogInput): Promise<boolean> {
  const { db, householdId, item, newStatus, role, requestedQuantity } = input;
  if (item.status === newStatus && requestedQuantity === undefined) {
    return false;
  }

  const timestampIso = new Date().toISOString();
  const anomaly = getInventoryAnomaly(item, newStatus);
  const payload = sanitizeFirestorePayload({
    status: newStatus,
    lastUpdated: timestampIso,
    updatedBy: role,
    verificationNeeded: anomaly.verificationNeeded,
    anomalyReason: anomaly.anomalyReason,
    requestedQuantity: requestedQuantity ?? (newStatus === 'in-stock' ? undefined : item.requestedQuantity),
  });

  const log = buildPantryLog({
    itemId: item.id,
    itemName: item.name,
    oldStatus: item.status,
    newStatus,
    role,
    timestampIso,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, `households/${householdId}/inventory`, item.id), payload);
  batch.set(doc(db, `households/${householdId}/logs`, log.id), log);
  await batch.commit();
  return true;
}

export async function addInventoryItem(db: Firestore, householdId: string, item: InventoryItem): Promise<void> {
  const category = normalizePantryCategory(item.category);
  const visual = resolveIngredientVisual({
    name: item.name,
    nameHi: item.nameHi,
    category,
    icon: item.icon,
  });

  const normalizedItem: InventoryItem = {
    ...item,
    category,
    icon: visual.fallbackIcon,
    nameHi: getResolvedNameHi(item.nameHi, visual.catalogMatch?.nativeName),
  };

  await setDoc(
    doc(db, `households/${householdId}/inventory`, normalizedItem.id),
    sanitizeFirestorePayload(normalizedItem),
  );
}

export async function deleteInventoryItem(db: Firestore, householdId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, `households/${householdId}/inventory`, itemId));
}

export async function addUnlistedItemWithLog(input: AddUnlistedItemWithLogInput): Promise<void> {
  const { db, householdId, name, status, category, requestedQuantity, role } = input;
  const timestampIso = new Date().toISOString();
  const normalizedCategory = normalizePantryCategory(category);
  const visual = resolveIngredientVisual({
    name,
    category: normalizedCategory,
  });
  const inventoryItem: InventoryItem = {
    id: generateId(),
    name,
    nameHi: getResolvedNameHi(undefined, visual.catalogMatch?.nativeName),
    category: normalizedCategory,
    status,
    icon: visual.fallbackIcon,
    requestedQuantity,
    lastUpdated: timestampIso,
    updatedBy: role,
    verificationNeeded: true,
    anomalyReason: 'New item requested by cook.',
  };

  const log = buildPantryLog({
    itemId: inventoryItem.id,
    itemName: inventoryItem.name,
    oldStatus: 'in-stock',
    newStatus: status,
    role,
    timestampIso,
  });

  const batch = writeBatch(db);
  batch.set(
    doc(db, `households/${householdId}/inventory`, inventoryItem.id),
    sanitizeFirestorePayload(inventoryItem),
  );
  batch.set(doc(db, `households/${householdId}/logs`, log.id), log);
  await batch.commit();
}

export async function queueUnknownIngredient(input: QueueUnknownIngredientInput): Promise<void> {
  const { db, householdId, name, status, category, requestedQuantity, role } = input;
  const queueId = generateId();
  const createdAt = new Date().toISOString();
  const normalizedCategory = normalizePantryCategory(category);

  const queueItem: UnknownIngredientQueueItem = {
    id: queueId,
    name,
    status: 'open',
    requestedStatus: status,
    category: normalizedCategory,
    requestedQuantity,
    createdAt,
    createdBy: role,
    resolution: undefined,
    resolvedAt: undefined,
    resolvedBy: undefined,
    promotedInventoryItemId: undefined,
  };

  await setDoc(
    doc(db, `households/${householdId}/unknownIngredientQueue`, queueId),
    sanitizeFirestorePayload(queueItem),
  );
}

export async function dismissUnknownIngredientQueueItem(input: ResolveUnknownIngredientQueueItemInput): Promise<void> {
  const { db, householdId, queueItem, role } = input;
  if (queueItem.status !== 'open') {
    throw new Error(`Cannot dismiss queue item ${queueItem.id} because it is already resolved.`);
  }

  await updateDoc(doc(db, `households/${householdId}/unknownIngredientQueue`, queueItem.id), {
    status: 'resolved',
    resolution: 'dismissed',
    resolvedAt: new Date().toISOString(),
    resolvedBy: role,
  });
}

export async function promoteUnknownIngredientQueueItem(input: ResolveUnknownIngredientQueueItemInput): Promise<void> {
  const { db, householdId, queueItem, role } = input;
  if (queueItem.status !== 'open') {
    throw new Error(`Cannot promote queue item ${queueItem.id} because it is already resolved.`);
  }

  const timestampIso = new Date().toISOString();
  const normalizedCategory = normalizePantryCategory(queueItem.category);
  const visual = resolveIngredientVisual({
    name: queueItem.name,
    category: normalizedCategory,
  });
  const inventoryItemId = generateId();
  const inventoryItem: InventoryItem = {
    id: inventoryItemId,
    name: queueItem.name,
    nameHi: getResolvedNameHi(undefined, visual.catalogMatch?.nativeName),
    category: normalizedCategory,
    status: queueItem.requestedStatus,
    icon: visual.fallbackIcon,
    requestedQuantity: queueItem.requestedQuantity,
    lastUpdated: timestampIso,
    updatedBy: role,
    verificationNeeded: false,
    anomalyReason: '',
  };

  const batch = writeBatch(db);
  batch.set(
    doc(db, `households/${householdId}/inventory`, inventoryItemId),
    sanitizeFirestorePayload(inventoryItem),
  );
  batch.update(doc(db, `households/${householdId}/unknownIngredientQueue`, queueItem.id), {
    status: 'resolved',
    resolution: 'promoted',
    resolvedAt: timestampIso,
    resolvedBy: role,
    promotedInventoryItemId: inventoryItemId,
  });
  await batch.commit();
}

export async function clearAnomaly(db: Firestore, householdId: string, itemId: string): Promise<void> {
  await updateDoc(doc(db, `households/${householdId}/inventory`, itemId), {
    verificationNeeded: false,
    anomalyReason: '',
  });
}
