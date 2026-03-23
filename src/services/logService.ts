import { PantryLog, Role, InventoryStatus } from '../types';
import { generateId } from '../utils/id';

interface PantryLogInput {
  itemId: string;
  itemName: string;
  oldStatus: InventoryStatus;
  newStatus: InventoryStatus;
  role: Role;
  timestampIso: string;
}

export function buildPantryLog(input: PantryLogInput): PantryLog {
  return {
    id: generateId(),
    itemId: input.itemId,
    itemName: input.itemName,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    timestamp: input.timestampIso,
    role: input.role,
  };
}
