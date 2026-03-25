import { User as FirebaseUser } from 'firebase/auth';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { Role, UiLanguage } from '../types';
import { seedHouseholdData } from './seedService';

export interface HouseholdData {
  ownerId: string;
  cookEmail: string;
  ownerLanguage?: UiLanguage;
  cookLanguage?: UiLanguage;
}

export interface ResolvedHousehold {
  householdId: string;
  role: Role;
}

function selectDeterministicHouseholdId(ids: string[]): string | null {
  if (ids.length === 0) {
    return null;
  }
  return [...ids].sort((left, right) => left.localeCompare(right))[0];
}

async function findCookHouseholdId(db: Firestore, userEmail: string): Promise<string | null> {
  const normalizedEmail = userEmail.toLowerCase();
  const cookQuery = query(collection(db, 'households'), where('cookEmail', '==', normalizedEmail));
  const cookSnapshot = await getDocs(cookQuery);
  return selectDeterministicHouseholdId(cookSnapshot.docs.map((item) => item.id));
}

async function findOwnerHouseholdId(db: Firestore, ownerId: string): Promise<string | null> {
  const ownerQuery = query(collection(db, 'households'), where('ownerId', '==', ownerId));
  const ownerSnapshot = await getDocs(ownerQuery);
  return selectDeterministicHouseholdId(ownerSnapshot.docs.map((item) => item.id));
}

interface EnsuredHousehold {
  householdId: string;
  wasCreated: boolean;
}

async function ensureOwnerHousehold(db: Firestore, ownerId: string): Promise<EnsuredHousehold> {
  const householdRef = doc(db, 'households', ownerId);

  return runTransaction(db, async (transaction): Promise<EnsuredHousehold> => {
    const householdSnapshot = await transaction.get(householdRef);
    if (householdSnapshot.exists()) {
      return {
        householdId: householdRef.id,
        wasCreated: false,
      };
    }

    transaction.set(householdRef, {
      ownerId,
      cookEmail: '',
      ownerLanguage: 'en',
      cookLanguage: 'hi',
    });
    return {
      householdId: householdRef.id,
      wasCreated: true,
    };
  });
}

export async function resolveOrCreateHousehold(db: Firestore, user: FirebaseUser): Promise<ResolvedHousehold> {
  if (user.email) {
    const cookHouseholdId = await findCookHouseholdId(db, user.email);
    if (cookHouseholdId) {
      return { householdId: cookHouseholdId, role: 'cook' };
    }
  }

  const ownerHouseholdId = await findOwnerHouseholdId(db, user.uid);
  if (ownerHouseholdId) {
    return { householdId: ownerHouseholdId, role: 'owner' };
  }

  const ensuredHousehold = await ensureOwnerHousehold(db, user.uid);
  if (ensuredHousehold.wasCreated) {
    await seedHouseholdData(db, ensuredHousehold.householdId, user.uid);
  }

  return { householdId: ensuredHousehold.householdId, role: 'owner' };
}
