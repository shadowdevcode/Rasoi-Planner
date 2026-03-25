import {
  Firestore,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { InventoryItem, InventoryStatus, Role } from '../types';
import { sanitizeFirestorePayload } from '../utils/firestorePayload';
import { generateId } from '../utils/id';
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
  const normalizedItem: InventoryItem = {
    ...item,
    category: normalizePantryCategory(item.category),
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
  const inventoryItem: InventoryItem = {
    id: generateId(),
    name,
    category: normalizePantryCategory(category),
    status,
    icon: '🆕',
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

export async function clearAnomaly(db: Firestore, householdId: string, itemId: string): Promise<void> {
  await updateDoc(doc(db, `households/${householdId}/inventory`, itemId), {
    verificationNeeded: false,
    anomalyReason: '',
  });
}
