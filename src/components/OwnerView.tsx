import React, { useState } from 'react';
import { CalendarDays, ShoppingCart, Package } from 'lucide-react';
import { MealPlan, InventoryItem, InventoryStatus, PantryLog } from '../types';
import MealPlanner from './MealPlanner';
import GroceryList from './GroceryList';
import Pantry from './Pantry';

interface Props {
  meals: Record<string, MealPlan>;
  onUpdateMeal: (dateStr: string, field: keyof MealPlan, value: string) => void;
  inventory: InventoryItem[];
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
  onDeleteInventoryItem: (id: string) => void;
  onClearAnomaly: (id: string) => void;
  logs: PantryLog[];
}

export default function OwnerView({ meals, onUpdateMeal, inventory, onAddInventoryItem, onUpdateInventory, onDeleteInventoryItem, onClearAnomaly, logs }: Props) {
  const [activeTab, setActiveTab] = useState<'meals' | 'grocery' | 'pantry'>('meals');

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="bg-white rounded-full p-1.5 shadow-sm border border-stone-200 inline-flex overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('meals')}
            className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'meals' ? 'bg-orange-100 text-orange-700' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <CalendarDays size={18} />
            Meal Plan
          </button>
          <button
            onClick={() => setActiveTab('grocery')}
            className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'grocery' ? 'bg-orange-100 text-orange-700' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <ShoppingCart size={18} />
            Grocery List
          </button>
          <button
            onClick={() => setActiveTab('pantry')}
            className={`flex items-center gap-2 px-4 md:px-6 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'pantry' ? 'bg-orange-100 text-orange-700' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <Package size={18} />
            Pantry & Logs
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4 md:p-6 min-h-[600px]">
        {activeTab === 'meals' && <MealPlanner meals={meals} onUpdateMeal={onUpdateMeal} />}
        {activeTab === 'grocery' && <GroceryList inventory={inventory} onUpdateInventory={onUpdateInventory} />}
        {activeTab === 'pantry' && <Pantry inventory={inventory} onAddInventoryItem={onAddInventoryItem} onUpdateInventory={onUpdateInventory} onDeleteInventoryItem={onDeleteInventoryItem} onClearAnomaly={onClearAnomaly} logs={logs} />}
      </div>
    </div>
  );
}
