import React, { useState, useEffect } from 'react';
import { ChefHat, User, LogIn, Loader2 } from 'lucide-react';
import { Role, InventoryItem, MealPlan, PantryLog, InventoryStatus } from './types';
import OwnerView from './components/OwnerView';
import CookView from './components/CookView';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs, where } from 'firebase/firestore';

const today = new Date().toISOString().split('T')[0];

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: '1', name: 'Turmeric (Haldi)', nameHi: 'हल्दी', category: 'Spices', status: 'in-stock', icon: '🟡', defaultQuantity: '200g' },
  { id: '2', name: 'Red Chilli Powder', nameHi: 'लाल मिर्च', category: 'Spices', status: 'in-stock', icon: '🌶️', defaultQuantity: '200g' },
  { id: '3', name: 'Garam Masala', nameHi: 'गरम मसाला', category: 'Spices', status: 'in-stock', icon: '🧆', defaultQuantity: '100g' },
  { id: '4', name: 'Toor Dal', nameHi: 'तूर दाल', category: 'Pulses', status: 'in-stock', icon: '🥣', defaultQuantity: '1kg' },
  { id: '5', name: 'Basmati Rice', nameHi: 'चावल', category: 'Staples', status: 'in-stock', icon: '🍚', defaultQuantity: '5kg' },
  { id: '6', name: 'Atta (Wheat Flour)', nameHi: 'आटा', category: 'Staples', status: 'low', icon: '🌾', defaultQuantity: '5kg' },
  { id: '7', name: 'Mustard Oil', nameHi: 'सरसों का तेल', category: 'Staples', status: 'in-stock', icon: '🛢️', defaultQuantity: '1L' },
  { id: '8', name: 'Onions', nameHi: 'प्याज', category: 'Veggies', status: 'in-stock', icon: '🧅', defaultQuantity: '2kg' },
  { id: '9', name: 'Tomatoes', nameHi: 'टमाटर', category: 'Veggies', status: 'out', icon: '🍅', defaultQuantity: '1kg' },
  { id: '10', name: 'Milk', nameHi: 'दूध', category: 'Dairy', status: 'in-stock', icon: '🥛', defaultQuantity: '1L' },
];

const INITIAL_MEALS: Record<string, MealPlan> = {
  [today]: { 
    morning: 'Aloo Paratha, Curd, Pickle', 
    evening: 'Dal Tadka, Jeera Rice, Bhindi Fry',
    notes: 'Make parathas less spicy for kids.',
    leftovers: 'Use yesterday\'s leftover dal for paratha dough.'
  }
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [role, setRole] = useState<Role>('owner');
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdData, setHouseholdData] = useState<{ownerId: string, cookEmail: string} | null>(null);
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [meals, setMeals] = useState<Record<string, MealPlan>>({});
  const [logs, setLogs] = useState<PantryLog[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAuthReady(true);
        setHouseholdId(null);
        setHouseholdData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubHousehold: any;
    let unsubInventory: any;
    let unsubMeals: any;
    let unsubLogs: any;

    const init = async () => {
      try {
        let hId = null;
        let currentRole: Role = 'owner';
        
        // 1. Check if user is a cook FIRST (prioritizes invites over their own default household)
        if (user.email) {
          const cookQ = query(collection(db, 'households'), where('cookEmail', '==', user.email.toLowerCase()));
          const cookSnap = await getDocs(cookQ);
          if (!cookSnap.empty) {
            hId = cookSnap.docs[0].id;
            currentRole = 'cook';
          }
        }

        // 2. If not a cook, check if user is an owner of an existing household
        if (!hId) {
          const ownerQ = query(collection(db, 'households'), where('ownerId', '==', user.uid));
          const ownerSnap = await getDocs(ownerQ);
          
          if (!ownerSnap.empty) {
            hId = ownerSnap.docs[0].id;
            currentRole = 'owner';
          }
        }

        // 3. If neither, create a new household and migrate legacy data if it exists
        if (!hId) {
          const newRef = doc(collection(db, 'households'));
          await setDoc(newRef, { ownerId: user.uid, cookEmail: '' });
          hId = newRef.id;
          currentRole = 'owner';
          
          // Check for legacy data
          const legacyInvQ = query(collection(db, `users/${user.uid}/inventory`));
          const legacyInvSnap = await getDocs(legacyInvQ);
          
          if (!legacyInvSnap.empty) {
            // Migrate legacy data
            for (const docSnap of legacyInvSnap.docs) {
              await setDoc(doc(db, `households/${hId}/inventory`, docSnap.id), docSnap.data());
            }
            const legacyMealsQ = query(collection(db, `users/${user.uid}/meals`));
            const legacyMealsSnap = await getDocs(legacyMealsQ);
            for (const docSnap of legacyMealsSnap.docs) {
              await setDoc(doc(db, `households/${hId}/meals`, docSnap.id), docSnap.data());
            }
          } else {
            await seedInitialData(hId);
          }
        }

        setHouseholdId(hId);
        setRole(currentRole);

        // 4. Set up real-time listeners
        unsubHousehold = onSnapshot(doc(db, 'households', hId), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as {ownerId: string, cookEmail: string};
            setHouseholdData(data);
            // If cook was removed, reload to reset state
            if (currentRole === 'cook' && data.cookEmail !== user.email) {
              window.location.reload();
            }
          }
        });

        const inventoryRef = collection(db, `households/${hId}/inventory`);
        const mealsRef = collection(db, `households/${hId}/meals`);
        const logsRef = collection(db, `households/${hId}/logs`);

        unsubInventory = onSnapshot(inventoryRef, (snapshot) => {
          const items: InventoryItem[] = [];
          snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as InventoryItem));
          setInventory(items);
        }, (error) => handleFirestoreError(error, OperationType.LIST, `households/${hId}/inventory`));

        unsubMeals = onSnapshot(mealsRef, (snapshot) => {
          const mealsData: Record<string, MealPlan> = {};
          snapshot.forEach((doc) => {
            mealsData[doc.id] = doc.data() as MealPlan;
          });
          setMeals(mealsData);
        }, (error) => handleFirestoreError(error, OperationType.LIST, `households/${hId}/meals`));

        const qLogs = query(logsRef, orderBy('timestamp', 'desc'));
        unsubLogs = onSnapshot(qLogs, (snapshot) => {
          const logsData: PantryLog[] = [];
          snapshot.forEach((doc) => logsData.push({ id: doc.id, ...doc.data() } as PantryLog));
          setLogs(logsData);
          setIsDataLoaded(true);
          setIsAuthReady(true);
        }, (error) => handleFirestoreError(error, OperationType.LIST, `households/${hId}/logs`));

      } catch (error) {
        console.error("Error initializing household:", error);
        setIsAuthReady(true);
      }
    };

    init();

    return () => {
      if (unsubHousehold) unsubHousehold();
      if (unsubInventory) unsubInventory();
      if (unsubMeals) unsubMeals();
      if (unsubLogs) unsubLogs();
    };
  }, [user]);

  const seedInitialData = async (hId: string) => {
    try {
      for (const item of INITIAL_INVENTORY) {
        await setDoc(doc(db, `households/${hId}/inventory`, item.id), item);
      }
      for (const [date, meal] of Object.entries(INITIAL_MEALS)) {
        await setDoc(doc(db, `households/${hId}/meals`, date), meal);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `households/${hId}`);
    }
  };

  const handleUpdateInventory = async (id: string, newStatus: InventoryStatus, requestedQuantity?: string) => {
    if (!user || !householdId) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    if (item.status !== newStatus || requestedQuantity) {
      let verificationNeeded = false;
      let anomalyReason = '';
      
      if (newStatus === 'out' && item.lastUpdated) {
        const daysSinceUpdate = (new Date().getTime() - new Date(item.lastUpdated).getTime()) / (1000 * 3600 * 24);
        if (daysSinceUpdate < 2 && item.status === 'in-stock') {
          verificationNeeded = true;
          anomalyReason = `Marked finished unusually fast (in ${Math.round(daysSinceUpdate * 10) / 10} days).`;
        }
      }

      const updates: Partial<InventoryItem> = {
        status: newStatus,
        lastUpdated: new Date().toISOString(),
        updatedBy: role,
        verificationNeeded,
        anomalyReason: anomalyReason || undefined,
        requestedQuantity: requestedQuantity || (newStatus === 'in-stock' ? undefined : item.requestedQuantity)
      };

      // Remove undefined values for Firestore
      Object.keys(updates).forEach(key => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

      try {
        await updateDoc(doc(db, `households/${householdId}/inventory`, id), updates);
        
        const newLog: PantryLog = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          itemId: item.id,
          itemName: item.name,
          oldStatus: item.status,
          newStatus: newStatus,
          timestamp: new Date().toISOString(),
          role: role
        };
        await setDoc(doc(db, `households/${householdId}/logs`, newLog.id), newLog);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/inventory/${id}`);
      }
    }
  };

  const handleAddInventoryItem = async (item: InventoryItem) => {
    if (!user || !householdId) return;
    try {
      const data = { ...item };
      // Remove undefined values
      Object.keys(data).forEach(key => data[key as keyof typeof data] === undefined && delete data[key as keyof typeof data]);
      await setDoc(doc(db, `households/${householdId}/inventory`, item.id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `households/${householdId}/inventory/${item.id}`);
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    if (!user || !householdId) return;
    try {
      await deleteDoc(doc(db, `households/${householdId}/inventory`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `households/${householdId}/inventory/${id}`);
    }
  };

  const handleAddUnlistedItem = async (name: string, status: InventoryStatus, category: string, requestedQuantity?: string) => {
    if (!user || !householdId) return;
    const newItem: InventoryItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      name: name,
      category: category || 'Requested',
      status: status,
      icon: '🆕',
      requestedQuantity,
      lastUpdated: new Date().toISOString(),
      updatedBy: role,
      verificationNeeded: true,
      anomalyReason: 'New item requested by cook.'
    };
    
    try {
      const data = { ...newItem };
      Object.keys(data).forEach(key => data[key as keyof typeof data] === undefined && delete data[key as keyof typeof data]);
      await setDoc(doc(db, `households/${householdId}/inventory`, newItem.id), data);
      
      const newLog: PantryLog = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        itemId: newItem.id,
        itemName: newItem.name,
        oldStatus: 'in-stock',
        newStatus: status,
        timestamp: new Date().toISOString(),
        role: role
      };
      await setDoc(doc(db, `households/${householdId}/logs`, newLog.id), newLog);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `households/${householdId}/inventory/${newItem.id}`);
    }
  };

  const handleClearAnomaly = async (id: string) => {
    if (!user || !householdId) return;
    try {
      await updateDoc(doc(db, `households/${householdId}/inventory`, id), {
        verificationNeeded: false,
        anomalyReason: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/inventory/${id}`);
    }
  };

  const handleUpdateMeal = async (dateStr: string, field: keyof MealPlan, value: string) => {
    if (!user || !householdId) return;
    try {
      const currentMeal = meals[dateStr] || { morning: '', evening: '', notes: '', leftovers: '' };
      const updatedMeal = { ...currentMeal, [field]: value };
      Object.keys(updatedMeal).forEach(key => updatedMeal[key as keyof typeof updatedMeal] === undefined && delete updatedMeal[key as keyof typeof updatedMeal]);
      await setDoc(doc(db, `households/${householdId}/meals`, dateStr), updatedMeal);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `households/${householdId}/meals/${dateStr}`);
    }
  };

  const handleInviteCook = async () => {
    if (!householdId || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await updateDoc(doc(db, 'households', householdId), {
        cookEmail: inviteEmail.trim().toLowerCase()
      });
      setInviteEmail('');
      alert('Cook invited successfully! They can now log in with this email.');
    } catch (error) {
      console.error(error);
      alert('Failed to invite cook. Please try again.');
    }
    setIsInviting(false);
  };

  const handleRemoveCook = async () => {
    if (!householdId) return;
    if (!window.confirm('Are you sure you want to remove the cook? They will lose access immediately.')) return;
    try {
      await updateDoc(doc(db, 'households', householdId), {
        cookEmail: ''
      });
    } catch (error) {
      console.error(error);
      alert('Failed to remove cook.');
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
          <p className="text-stone-500 mb-8">Sign in to sync your pantry and meal plans across all devices.</p>
          <button
            onClick={loginWithGoogle}
            className="w-full bg-orange-600 text-white py-3 px-4 rounded-xl font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="bg-orange-600 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ChefHat size={28} />
            <h1 className="text-2xl font-bold tracking-tight hidden sm:block">Rasoi Planner</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-orange-700 rounded-lg p-1 shadow-inner px-3 py-1.5">
              <span className="text-white text-sm font-bold flex items-center gap-2">
                {role === 'owner' ? <User size={16} /> : <ChefHat size={16} />}
                {role === 'owner' ? 'Owner View' : 'Cook View'}
              </span>
            </div>
            <button
              onClick={logout}
              className="text-orange-100 hover:text-white text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {role === 'owner' && householdData && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-stone-800">Household Settings</h3>
              <p className="text-sm text-stone-500">
                {householdData.cookEmail 
                  ? `Cook access granted to: ${householdData.cookEmail}` 
                  : 'Invite your cook to sync the pantry.'}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {householdData.cookEmail ? (
                <button 
                  onClick={handleRemoveCook}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors whitespace-nowrap"
                >
                  Remove Cook
                </button>
              ) : (
                <div className="flex w-full sm:w-auto gap-2">
                  <input 
                    type="email" 
                    placeholder="Cook's Gmail address" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="px-3 py-2 border border-stone-300 rounded-lg text-sm w-full sm:w-64 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <button 
                    onClick={handleInviteCook}
                    disabled={isInviting || !inviteEmail}
                    className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-bold hover:bg-stone-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isInviting ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 md:p-6 pb-24">
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
          />
        ) : (
          <CookView 
            meals={meals} 
            inventory={inventory} 
            onUpdateInventory={handleUpdateInventory} 
            onAddUnlistedItem={handleAddUnlistedItem}
          />
        )}
      </main>
    </div>
  );
}
