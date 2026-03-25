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
import { resolveIngredientVisual } from '../utils/ingredientVisuals';
import { normalizePantryCategory } from '../utils/pantryCategory';

function createSeedInventoryItem(item: Omit<InventoryItem, 'icon'>): InventoryItem {
  const visual = resolveIngredientVisual({
    name: item.name,
    nameHi: item.nameHi,
    category: item.category,
  });

  return {
    ...item,
    icon: visual.fallbackIcon,
  };
}

const initialInventory: InventoryItem[] = [
  createSeedInventoryItem({ id: '1', name: 'Turmeric (Haldi)', nameHi: 'हल्दी', category: normalizePantryCategory('Spices'), status: 'in-stock', defaultQuantity: '200g' }),
  createSeedInventoryItem({ id: '2', name: 'Red Chilli Powder', nameHi: 'लाल मिर्च', category: normalizePantryCategory('Spices'), status: 'in-stock', defaultQuantity: '200g' }),
  createSeedInventoryItem({ id: '3', name: 'Garam Masala', nameHi: 'गरम मसाला', category: normalizePantryCategory('Spices'), status: 'in-stock', defaultQuantity: '100g' }),
  createSeedInventoryItem({ id: '4', name: 'Jeera (Cumin Seeds)', nameHi: 'जीरा', category: normalizePantryCategory('Spices'), status: 'in-stock', defaultQuantity: '200g' }),
  createSeedInventoryItem({ id: '5', name: 'Dhania Powder', nameHi: 'धनिया पाउडर', category: normalizePantryCategory('Spices'), status: 'in-stock', defaultQuantity: '200g' }),
  createSeedInventoryItem({ id: '6', name: 'Ajwain', nameHi: 'अजवाइन', category: normalizePantryCategory('Spices'), status: 'in-stock', defaultQuantity: '100g' }),
  createSeedInventoryItem({ id: '7', name: 'Kasuri Methi', nameHi: 'कसूरी मेथी', category: normalizePantryCategory('Spices'), status: 'low', defaultQuantity: '50g' }),
  createSeedInventoryItem({ id: '8', name: 'Toor Dal', nameHi: 'तूर दाल', category: normalizePantryCategory('Pulses'), status: 'in-stock', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '9', name: 'Moong Dal', nameHi: 'मूंग दाल', category: normalizePantryCategory('Pulses'), status: 'in-stock', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '10', name: 'Masoor Dal', nameHi: 'मसूर दाल', category: normalizePantryCategory('Pulses'), status: 'in-stock', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '11', name: 'Chana Dal', nameHi: 'चना दाल', category: normalizePantryCategory('Pulses'), status: 'low', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '12', name: 'Rajma', nameHi: 'राजमा', category: normalizePantryCategory('Pulses'), status: 'in-stock', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '13', name: 'Basmati Rice', nameHi: 'चावल', category: normalizePantryCategory('Staples'), status: 'in-stock', defaultQuantity: '5kg' }),
  createSeedInventoryItem({ id: '14', name: 'Atta (Wheat Flour)', nameHi: 'आटा', category: normalizePantryCategory('Staples'), status: 'low', defaultQuantity: '10kg' }),
  createSeedInventoryItem({ id: '15', name: 'Besan', nameHi: 'बेसन', category: normalizePantryCategory('Staples'), status: 'in-stock', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '16', name: 'Suji (Semolina)', nameHi: 'सूजी', category: normalizePantryCategory('Staples'), status: 'in-stock', defaultQuantity: '500g' }),
  createSeedInventoryItem({ id: '17', name: 'Mustard Oil', nameHi: 'सरसों का तेल', category: normalizePantryCategory('Staples'), status: 'in-stock', defaultQuantity: '1L' }),
  createSeedInventoryItem({ id: '18', name: 'Ghee', nameHi: 'घी', category: normalizePantryCategory('Dairy'), status: 'in-stock', defaultQuantity: '500g' }),
  createSeedInventoryItem({ id: '19', name: 'Onions', nameHi: 'प्याज', category: normalizePantryCategory('Veggies'), status: 'in-stock', defaultQuantity: '2kg' }),
  createSeedInventoryItem({ id: '20', name: 'Tomatoes', nameHi: 'टमाटर', category: normalizePantryCategory('Veggies'), status: 'out', defaultQuantity: '1kg' }),
  createSeedInventoryItem({ id: '21', name: 'Potatoes', nameHi: 'आलू', category: normalizePantryCategory('Veggies'), status: 'in-stock', defaultQuantity: '3kg' }),
  createSeedInventoryItem({ id: '22', name: 'Ginger', nameHi: 'अदरक', category: normalizePantryCategory('Veggies'), status: 'in-stock', defaultQuantity: '250g' }),
  createSeedInventoryItem({ id: '23', name: 'Garlic', nameHi: 'लहसुन', category: normalizePantryCategory('Veggies'), status: 'in-stock', defaultQuantity: '250g' }),
  createSeedInventoryItem({ id: '24', name: 'Green Chillies', nameHi: 'हरी मिर्च', category: normalizePantryCategory('Veggies'), status: 'low', defaultQuantity: '100g' }),
  createSeedInventoryItem({ id: '25', name: 'Coriander Leaves', nameHi: 'हरा धनिया', category: normalizePantryCategory('Veggies'), status: 'low', defaultQuantity: '2 bunches' }),
  createSeedInventoryItem({ id: '26', name: 'Milk', nameHi: 'दूध', category: normalizePantryCategory('Dairy'), status: 'in-stock', defaultQuantity: '1L' }),
  createSeedInventoryItem({ id: '27', name: 'Curd (Dahi)', nameHi: 'दही', category: normalizePantryCategory('Dairy'), status: 'in-stock', defaultQuantity: '500g' }),
  createSeedInventoryItem({ id: '28', name: 'Paneer', nameHi: 'पनीर', category: normalizePantryCategory('Dairy'), status: 'in-stock', defaultQuantity: '400g' }),
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
