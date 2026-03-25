export type Role = 'owner' | 'cook';
export type Language = 'en' | 'hi';
export type UiLanguage = 'en' | 'hi';

export interface MealPlan {
  morning: string;
  evening: string;
  notes?: string;
  leftovers?: string;
}

export type InventoryStatus = 'in-stock' | 'low' | 'out';

export interface InventoryItem {
  id: string;
  name: string;
  nameHi?: string;
  category: string;
  status: InventoryStatus;
  icon: string;
  lastUpdated?: string;
  updatedBy?: Role;
  verificationNeeded?: boolean;
  anomalyReason?: string;
  defaultQuantity?: string;
  requestedQuantity?: string;
}

export interface PantryLog {
  id: string;
  itemId: string;
  itemName: string;
  oldStatus: InventoryStatus;
  newStatus: InventoryStatus;
  timestamp: string;
  role: Role;
}

export interface AppState {
  role: Role;
  inventory: InventoryItem[];
  meals: Record<string, MealPlan>;
  logs: PantryLog[];
}

export interface HouseholdPreferences {
  ownerLanguage?: UiLanguage;
  cookLanguage?: UiLanguage;
}

export interface AiParseResult {
  understood: boolean;
  message?: string;
  updates: { itemId: string; newStatus: InventoryStatus; requestedQuantity?: string }[];
  unlistedItems: { name: string; status: InventoryStatus; category: string; requestedQuantity?: string }[];
}
