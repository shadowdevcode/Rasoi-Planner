import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  setDoc,
} from 'firebase/firestore';
import { InventoryItem, MealPlan } from '../types';
import { getLocalDateKey } from '../utils/date';
import { normalizePantryCategory } from '../utils/pantryCategory';

const initialInventory: InventoryItem[] = [
  { id: '1', name: 'Turmeric (Haldi)', nameHi: 'हल्दी', category: normalizePantryCategory('Spices'), status: 'in-stock', icon: '🟡', defaultQuantity: '200g' },
  { id: '2', name: 'Red Chilli Powder', nameHi: 'लाल मिर्च', category: normalizePantryCategory('Spices'), status: 'in-stock', icon: '🌶️', defaultQuantity: '200g' },
  { id: '3', name: 'Garam Masala', nameHi: 'गरम मसाला', category: normalizePantryCategory('Spices'), status: 'in-stock', icon: '🧆', defaultQuantity: '100g' },
  { id: '4', name: 'Toor Dal', nameHi: 'तूर दाल', category: normalizePantryCategory('Pulses'), status: 'in-stock', icon: '🥣', defaultQuantity: '1kg' },
  { id: '5', name: 'Basmati Rice', nameHi: 'चावल', category: normalizePantryCategory('Staples'), status: 'in-stock', icon: '🍚', defaultQuantity: '5kg' },
  { id: '6', name: 'Atta (Wheat Flour)', nameHi: 'आटा', category: normalizePantryCategory('Staples'), status: 'low', icon: '🌾', defaultQuantity: '5kg' },
  { id: '7', name: 'Mustard Oil', nameHi: 'सरसों का तेल', category: normalizePantryCategory('Staples'), status: 'in-stock', icon: '🛢️', defaultQuantity: '1L' },
  { id: '8', name: 'Onions', nameHi: 'प्याज', category: normalizePantryCategory('Veggies'), status: 'in-stock', icon: '🧅', defaultQuantity: '2kg' },
  { id: '9', name: 'Tomatoes', nameHi: 'टमाटर', category: normalizePantryCategory('Veggies'), status: 'out', icon: '🍅', defaultQuantity: '1kg' },
  { id: '10', name: 'Milk', nameHi: 'दूध', category: normalizePantryCategory('Dairy'), status: 'in-stock', icon: '🥛', defaultQuantity: '1L' },
];

function getInitialMeals(): Record<string, MealPlan> {
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

async function migrateLegacyData(db: Firestore, householdId: string, userId: string): Promise<boolean> {
  const legacyInventoryQuery = query(collection(db, `users/${userId}/inventory`));
  const legacyInventorySnapshot = await getDocs(legacyInventoryQuery);
  if (legacyInventorySnapshot.empty) {
    return false;
  }

  for (const inventoryDoc of legacyInventorySnapshot.docs) {
    await setDoc(doc(db, `households/${householdId}/inventory`, inventoryDoc.id), inventoryDoc.data());
  }

  const legacyMealsQuery = query(collection(db, `users/${userId}/meals`));
  const legacyMealsSnapshot = await getDocs(legacyMealsQuery);
  for (const mealDoc of legacyMealsSnapshot.docs) {
    await setDoc(doc(db, `households/${householdId}/meals`, mealDoc.id), mealDoc.data());
  }

  return true;
}

export async function seedHouseholdData(db: Firestore, householdId: string, userId: string): Promise<void> {
  const migrated = await migrateLegacyData(db, householdId, userId);
  if (migrated) {
    return;
  }

  for (const item of initialInventory) {
    await setDoc(doc(db, `households/${householdId}/inventory`, item.id), item);
  }
  const initialMeals = getInitialMeals();
  for (const [date, meal] of Object.entries(initialMeals)) {
    await setDoc(doc(db, `households/${householdId}/meals`, date), meal);
  }
}
