import React, { useEffect, useState } from 'react';
import { ChefHat, User, LogIn, Loader2, AlertCircle, CheckCircle2, Globe2, Mail } from 'lucide-react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import OwnerView from './components/OwnerView';
import CookView from './components/CookView';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { InventoryItem, InventoryStatus, MealPlan, PantryLog, Role, UiLanguage, UnknownIngredientQueueItem } from './types';
import { toUserFacingError } from './utils/error';
import {
  addInventoryItem,
  clearAnomaly,
  deleteInventoryItem,
  dismissUnknownIngredientQueueItem,
  promoteUnknownIngredientQueueItem,
  queueUnknownIngredient,
  updateInventoryStatusWithLog,
} from './services/inventoryService';
import { upsertMealField } from './services/mealService';
import { HouseholdData, resolveOrCreateHousehold } from './services/householdService';
import { getAppCopy } from './i18n/copy';

interface UiFeedback {
  kind: 'success' | 'error';
  message: string;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [role, setRole] = useState<Role>('owner');
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null);
  const [accessRevoked, setAccessRevoked] = useState(false);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [meals, setMeals] = useState<Record<string, MealPlan>>({});
  const [logs, setLogs] = useState<PantryLog[]>([]);
  const [unknownIngredientQueue, setUnknownIngredientQueue] = useState<UnknownIngredientQueueItem[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [uiFeedback, setUiFeedback] = useState<UiFeedback | null>(null);
  const isOwner = role === 'owner';
  const ownerLanguage: UiLanguage = householdData?.ownerLanguage ?? 'en';
  const cookLanguage: UiLanguage = householdData?.cookLanguage ?? 'hi';
  const activeLanguage: UiLanguage = isOwner ? ownerLanguage : cookLanguage;
  const appCopy = getAppCopy(activeLanguage);
  const shellWidthClass = isOwner ? 'max-w-7xl' : 'max-w-5xl';
  const shellSectionClass = `${shellWidthClass} mx-auto px-4 md:px-6`;
  const shellMainClass = `${shellWidthClass} mx-auto px-4 pb-24 pt-6 md:px-6`;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAuthReady(true);
        setIsDataLoaded(false);
        setHouseholdId(null);
        setHouseholdData(null);
        setAccessRevoked(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let householdUnsub: Unsubscribe | null = null;
    let inventoryUnsub: Unsubscribe | null = null;
    let mealsUnsub: Unsubscribe | null = null;
    let logsUnsub: Unsubscribe | null = null;
    let unknownQueueUnsub: Unsubscribe | null = null;
    let hasLoadedHousehold = false;
    let hasLoadedInventory = false;
    let hasLoadedMeals = false;
    let hasLoadedUnknownQueue = false;
    let hasResolvedInitialView = false;

    const markInitialViewReady = (): void => {
      if (hasResolvedInitialView) {
        return;
      }

      if (hasLoadedHousehold && hasLoadedInventory && hasLoadedMeals && hasLoadedUnknownQueue) {
        hasResolvedInitialView = true;
        setIsDataLoaded(true);
        setIsAuthReady(true);
      }
    };

    const initialize = async (): Promise<void> => {
      try {
        const resolved = await resolveOrCreateHousehold(db, user);
        setRole(resolved.role);
        setHouseholdId(resolved.householdId);

        householdUnsub = onSnapshot(
          doc(db, 'households', resolved.householdId),
          (snapshot) => {
            if (!snapshot.exists()) {
              setUiFeedback({ kind: 'error', message: 'Household configuration is missing.' });
              return;
            }

            const data = snapshot.data() as HouseholdData;
            setHouseholdData(data);
            hasLoadedHousehold = true;
            markInitialViewReady();

            if (resolved.role === 'cook') {
              const normalizedUserEmail = user.email?.toLowerCase() ?? '';
              if (data.cookEmail !== normalizedUserEmail) {
                setAccessRevoked(true);
                setIsDataLoaded(true);
                setUiFeedback({ kind: 'error', message: 'Your cook access has been removed by the owner.' });
              }
            }
          },
          (error) => {
            console.error('household_snapshot_failed', { error, householdId: resolved.householdId });
            setUiFeedback({ kind: 'error', message: 'Failed to load household details.' });
          },
        );

        inventoryUnsub = onSnapshot(
          collection(db, `households/${resolved.householdId}/inventory`),
          (snapshot) => {
            const items: InventoryItem[] = snapshot.docs.map((itemDoc) => ({
              id: itemDoc.id,
              ...(itemDoc.data() as Omit<InventoryItem, 'id'>),
            }));
            setInventory(items);
            hasLoadedInventory = true;
            markInitialViewReady();
          },
          (error) => {
            console.error('inventory_snapshot_failed', { error, householdId: resolved.householdId });
            setUiFeedback({ kind: 'error', message: 'Failed to load inventory items.' });
          },
        );

        mealsUnsub = onSnapshot(
          collection(db, `households/${resolved.householdId}/meals`),
          (snapshot) => {
            const mealData: Record<string, MealPlan> = {};
            snapshot.forEach((mealDoc) => {
              mealData[mealDoc.id] = mealDoc.data() as MealPlan;
            });
            setMeals(mealData);
            hasLoadedMeals = true;
            markInitialViewReady();
          },
          (error) => {
            console.error('meals_snapshot_failed', { error, householdId: resolved.householdId });
            setUiFeedback({ kind: 'error', message: 'Failed to load meal plans.' });
          },
        );

        logsUnsub = onSnapshot(
          query(collection(db, `households/${resolved.householdId}/logs`), orderBy('timestamp', 'desc')),
          (snapshot) => {
            const nextLogs: PantryLog[] = snapshot.docs.map((logDoc) => ({
              id: logDoc.id,
              ...(logDoc.data() as Omit<PantryLog, 'id'>),
            }));
            setLogs(nextLogs);
          },
          (error) => {
            console.error('logs_snapshot_failed', { error, householdId: resolved.householdId });
            setIsAuthReady(true);
            setIsDataLoaded(true);
            setUiFeedback({ kind: 'error', message: 'Failed to load activity logs.' });
          },
        );

        unknownQueueUnsub = onSnapshot(
          query(collection(db, `households/${resolved.householdId}/unknownIngredientQueue`), orderBy('createdAt', 'desc')),
          (snapshot) => {
            const queueItems: UnknownIngredientQueueItem[] = snapshot.docs.map((queueDoc) => ({
              id: queueDoc.id,
              ...(queueDoc.data() as Omit<UnknownIngredientQueueItem, 'id'>),
            }));
            setUnknownIngredientQueue(queueItems);
            hasLoadedUnknownQueue = true;
            markInitialViewReady();
          },
          (error) => {
            console.error('unknown_queue_snapshot_failed', { error, householdId: resolved.householdId });
            setUiFeedback({ kind: 'error', message: 'Failed to load unknown ingredient queue.' });
            hasLoadedUnknownQueue = true;
            markInitialViewReady();
          },
        );
      } catch (error) {
        console.error('household_initialize_failed', { error, userId: user.uid });
        setUiFeedback({ kind: 'error', message: 'Failed to initialize household data.' });
        setIsAuthReady(true);
      }
    };

    void initialize();

    return () => {
      if (householdUnsub) {
        householdUnsub();
      }
      if (inventoryUnsub) {
        inventoryUnsub();
      }
      if (mealsUnsub) {
        mealsUnsub();
      }
      if (logsUnsub) {
        logsUnsub();
      }
      if (unknownQueueUnsub) {
        unknownQueueUnsub();
      }
    };
  }, [user]);

  const handleUpdateInventory = async (id: string, newStatus: InventoryStatus, requestedQuantity?: string): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    const target = inventory.find((item) => item.id === id);
    if (!target) {
      setUiFeedback({ kind: 'error', message: 'Item not found. Please refresh and retry.' });
      return;
    }

    try {
      const changed = await updateInventoryStatusWithLog({
        db,
        householdId,
        item: target,
        newStatus,
        role,
        requestedQuantity,
      });
      if (changed) {
        setUiFeedback({ kind: 'success', message: 'Pantry status updated.' });
      }
    } catch (error) {
      console.error('inventory_update_failed', { error, householdId, itemId: id, newStatus, requestedQuantity });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not update pantry item.') });
    }
  };

  const handleAddInventoryItem = async (item: InventoryItem): Promise<void> => {
    if (!user || !householdId) {
      return;
    }
    try {
      await addInventoryItem(db, householdId, item);
      setUiFeedback({ kind: 'success', message: 'Ingredient added.' });
    } catch (error) {
      console.error('inventory_add_failed', { error, householdId, itemId: item.id });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not add inventory item.') });
    }
  };

  const handleDeleteInventoryItem = async (id: string): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    try {
      await deleteInventoryItem(db, householdId, id);
      setUiFeedback({ kind: 'success', message: 'Ingredient deleted.' });
    } catch (error) {
      console.error('inventory_delete_failed', { error, householdId, itemId: id });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not delete inventory item.') });
    }
  };

  const handleQueueUnknownIngredient = async (
    name: string,
    status: InventoryStatus,
    category: string,
    requestedQuantity?: string,
  ): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    try {
      await queueUnknownIngredient({
        db,
        householdId,
        name,
        status,
        category,
        requestedQuantity,
        role,
      });
      setUiFeedback({ kind: 'success', message: 'Queued unknown ingredient for owner review.' });
    } catch (error) {
      console.error('unknown_ingredient_queue_add_failed', { error, householdId, name, status, category, requestedQuantity });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not queue unknown ingredient.') });
    }
  };

  const handlePromoteUnknownIngredient = async (queueItem: UnknownIngredientQueueItem): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    try {
      await promoteUnknownIngredientQueueItem({
        db,
        householdId,
        queueItem,
        role,
      });
      setUiFeedback({ kind: 'success', message: 'Queued ingredient promoted to pantry.' });
    } catch (error) {
      console.error('unknown_ingredient_promote_failed', { error, householdId, queueItemId: queueItem.id });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not promote queued ingredient.') });
    }
  };

  const handleDismissUnknownIngredient = async (queueItem: UnknownIngredientQueueItem): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    try {
      await dismissUnknownIngredientQueueItem({
        db,
        householdId,
        queueItem,
        role,
      });
      setUiFeedback({ kind: 'success', message: 'Queued ingredient dismissed.' });
    } catch (error) {
      console.error('unknown_ingredient_dismiss_failed', { error, householdId, queueItemId: queueItem.id });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not dismiss queued ingredient.') });
    }
  };

  const handleClearAnomaly = async (id: string): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    try {
      await clearAnomaly(db, householdId, id);
      setUiFeedback({ kind: 'success', message: 'Verification warning cleared.' });
    } catch (error) {
      console.error('inventory_clear_anomaly_failed', { error, householdId, itemId: id });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not clear verification warning.') });
    }
  };

  const handleUpdateMeal = async (dateStr: string, field: keyof MealPlan, value: string): Promise<void> => {
    if (!user || !householdId) {
      return;
    }

    try {
      await upsertMealField(db, householdId, dateStr, meals[dateStr], field, value);
    } catch (error) {
      console.error('meal_update_failed', { error, householdId, dateStr, field });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Could not update meal plan.') });
    }
  };

  const handleInviteCook = async (): Promise<void> => {
    if (!householdId || !inviteEmail.trim()) {
      return;
    }

    setIsInviting(true);
    try {
      await updateDoc(doc(db, 'households', householdId), {
        cookEmail: inviteEmail.trim().toLowerCase(),
      });
      setInviteEmail('');
      setUiFeedback({ kind: 'success', message: 'Cook invited successfully.' });
    } catch (error) {
      console.error('invite_cook_failed', { error, householdId, inviteEmail });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Failed to invite cook.') });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateLanguagePreference = async (field: 'ownerLanguage' | 'cookLanguage', value: UiLanguage): Promise<void> => {
    if (!householdId) {
      return;
    }

    try {
      await updateDoc(doc(db, 'households', householdId), {
        [field]: value,
      });
      setUiFeedback({ kind: 'success', message: 'Language profile updated.' });
    } catch (error) {
      console.error('language_profile_update_failed', { error, householdId, field, value });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Failed to update language profile.') });
    }
  };

  const handleRemoveCook = async (): Promise<void> => {
    if (!householdId) {
      return;
    }

    const confirmed = window.confirm('Are you sure you want to remove the cook? They will lose access immediately.');
    if (!confirmed) {
      return;
    }

    try {
      await updateDoc(doc(db, 'households', householdId), {
        cookEmail: '',
      });
      setUiFeedback({ kind: 'success', message: 'Cook access removed.' });
    } catch (error) {
      console.error('remove_cook_failed', { error, householdId });
      setUiFeedback({ kind: 'error', message: toUserFacingError(error, 'Failed to remove cook.') });
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-600" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-orange-100 p-4 rounded-full">
              <ChefHat size={48} className="text-orange-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Rasoi Planner</h1>
          <p className="text-stone-500 mb-8">{appCopy.signInPrompt}</p>
          <button
            onClick={loginWithGoogle}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
            data-testid="sign-in-button"
          >
            <LogIn size={20} />
            {appCopy.signInWithGoogle}
          </button>
        </div>
      </div>
    );
  }

  if (accessRevoked) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={40} />
          <h1 className="text-2xl font-bold text-stone-800 mb-2">{appCopy.accessRemoved}</h1>
          <p className="text-stone-500 mb-6">{appCopy.accessRemovedDetail}</p>
          <button
            onClick={logout}
            className="w-full bg-stone-800 text-white py-3 px-4 rounded-xl font-bold hover:bg-stone-700 transition-colors"
          >
            {appCopy.signOut}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-orange-600 via-orange-600 to-orange-500 text-white shadow-[0_10px_30px_rgba(154,52,18,0.18)]">
        <div className={`${shellSectionClass} py-4`}>
          <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/10 px-4 py-3 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15">
                <ChefHat size={24} />
              </div>
              <div className="min-w-0">
                <h1 className="hidden text-2xl font-bold tracking-tight sm:block">Rasoi Planner</h1>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-orange-100/80">
                  {isOwner ? appCopy.ownerWorkspace : appCopy.cookWorkspace}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white shadow-inner">
                {isOwner ? <User size={16} /> : <ChefHat size={16} />}
                <span>{isOwner ? appCopy.ownerRole : appCopy.cookRole}</span>
              </div>
              <button
                onClick={logout}
                className="text-sm font-medium text-orange-50 transition-colors hover:text-white"
              >
                {appCopy.signOut}
              </button>
            </div>
          </div>
        </div>
      </header>

      {uiFeedback && (
        <div className={`${shellSectionClass} pt-4`}>
          <div
            className={`rounded-xl px-4 py-3 border flex items-center gap-2 text-sm font-medium ${
              uiFeedback.kind === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {uiFeedback.kind === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{uiFeedback.message}</span>
          </div>
        </div>
      )}

      {role === 'owner' && householdData && (
        <div className={`${shellSectionClass} pt-6`}>
          <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{appCopy.householdSettings}</p>
                <h3 className="text-2xl font-semibold tracking-tight text-stone-900">{appCopy.householdSettings}</h3>
                <p className="text-sm leading-6 text-stone-500">{appCopy.householdSettingsHelper}</p>
              </div>
              {householdData.cookEmail ? (
                <div className="inline-flex max-w-full items-center gap-2 self-start rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 shadow-sm">
                  <Mail size={14} />
                  <span className="truncate">{householdData.cookEmail}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
              <div className="rounded-[24px] border border-stone-200/80 bg-stone-50/70 p-4 md:p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-stone-800">
                  <Globe2 size={16} className="text-orange-600" />
                  <span>{appCopy.languageProfiles}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="flex h-full flex-col gap-2 rounded-[20px] border border-stone-200/80 bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{appCopy.ownerLanguageLabel}</span>
                    <select
                      value={ownerLanguage}
                      onChange={(event) => void handleUpdateLanguagePreference('ownerLanguage', event.target.value as UiLanguage)}
                      className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      data-testid="owner-language-select"
                    >
                      <option value="en">English + Hinglish helper</option>
                      <option value="hi">Hindi + Hinglish helper</option>
                    </select>
                    <span className="text-xs leading-5 text-stone-500">{appCopy.ownerLanguageHint}</span>
                  </label>
                  <label className="flex h-full flex-col gap-2 rounded-[20px] border border-stone-200/80 bg-white p-4 shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{appCopy.cookLanguageLabel}</span>
                    <select
                      value={cookLanguage}
                      onChange={(event) => void handleUpdateLanguagePreference('cookLanguage', event.target.value as UiLanguage)}
                      className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      data-testid="cook-language-select"
                    >
                      <option value="hi">Hindi + Hinglish helper</option>
                      <option value="en">English + Hinglish helper</option>
                    </select>
                    <span className="text-xs leading-5 text-stone-500">{appCopy.cookLanguageHint}</span>
                  </label>
                </div>
              </div>

              <div className="rounded-[24px] border border-stone-200/80 bg-stone-50/70 p-4 md:p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                    <User size={16} className="text-orange-600" />
                    <span>{appCopy.cookAccess}</span>
                  </div>
                  <p className="text-sm leading-6 text-stone-500">{householdData.cookEmail ? householdData.cookEmail : appCopy.inviteCookHint}</p>
                </div>

                <div className="mt-4">
                  {householdData.cookEmail ? (
                    <button
                      onClick={handleRemoveCook}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 sm:w-auto"
                    >
                      {appCopy.removeCook}
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        placeholder={appCopy.inviteCookPlaceholder}
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 sm:min-w-[17rem]"
                      />
                      <button
                        onClick={handleInviteCook}
                        disabled={isInviting || !inviteEmail}
                        className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
                      >
                        {isInviting ? appCopy.inviting : appCopy.invite}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <main className={shellMainClass}>
        {!isDataLoaded ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-orange-600" size={48} />
          </div>
        ) : role === 'owner' ? (
          <OwnerView
            meals={meals}
            onUpdateMeal={handleUpdateMeal}
            inventory={inventory}
            onAddInventoryItem={handleAddInventoryItem}
            onUpdateInventory={handleUpdateInventory}
            onDeleteInventoryItem={handleDeleteInventoryItem}
            onClearAnomaly={handleClearAnomaly}
            logs={logs}
            unknownIngredientQueue={unknownIngredientQueue}
            onPromoteUnknownIngredient={handlePromoteUnknownIngredient}
            onDismissUnknownIngredient={handleDismissUnknownIngredient}
            language={ownerLanguage}
          />
        ) : (
          <CookView
            meals={meals}
            inventory={inventory}
            onUpdateInventory={handleUpdateInventory}
            onQueueUnknownIngredient={handleQueueUnknownIngredient}
            language={cookLanguage}
          />
        )}
      </main>
    </div>
  );
}
