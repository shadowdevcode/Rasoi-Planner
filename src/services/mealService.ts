import { Firestore, doc, setDoc } from 'firebase/firestore';
import { MealPlan } from '../types';
import { sanitizeFirestorePayload } from '../utils/firestorePayload';

export async function upsertMealField(
  db: Firestore,
  householdId: string,
  dateKey: string,
  currentMeal: MealPlan | undefined,
  field: keyof MealPlan,
  value: string,
): Promise<void> {
  const baseline: MealPlan = currentMeal ?? {
    morning: '',
    evening: '',
    notes: '',
    leftovers: '',
  };
  const payload: MealPlan = {
    ...baseline,
    [field]: value,
  };
  await setDoc(
    doc(db, `households/${householdId}/meals`, dateKey),
    sanitizeFirestorePayload(payload),
  );
}
