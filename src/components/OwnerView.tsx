import React, { useState } from 'react';
import { CalendarDays, ShoppingCart, Package } from 'lucide-react';
import { MealPlan, InventoryItem, InventoryStatus, PantryLog, UiLanguage } from '../types';
import MealPlanner from './MealPlanner';
import GroceryList from './GroceryList';
import Pantry from './Pantry';
import { getOwnerCopy } from '../i18n/copy';

interface Props {
  meals: Record<string, MealPlan>;
  onUpdateMeal: (dateStr: string, field: keyof MealPlan, value: string) => void;
  inventory: InventoryItem[];
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
  onDeleteInventoryItem: (id: string) => void;
  onClearAnomaly: (id: string) => void;
  logs: PantryLog[];
  language: UiLanguage;
}

export default function OwnerView({ meals, onUpdateMeal, inventory, onAddInventoryItem, onUpdateInventory, onDeleteInventoryItem, onClearAnomaly, logs, language }: Props) {
  const [activeTab, setActiveTab] = useState<'meals' | 'grocery' | 'pantry'>('meals');
  const copy = getOwnerCopy(language);
  const panelClassName = 'min-h-[600px] rounded-[28px] border border-stone-200/80 bg-stone-50/60 p-3 shadow-sm md:p-4';
  const tabButtonClass = (tab: 'meals' | 'grocery' | 'pantry'): string =>
    `flex min-w-0 items-center justify-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold transition-all ${
      activeTab === tab
        ? 'border border-orange-200 bg-orange-100 text-orange-800 shadow-sm'
        : 'border border-transparent bg-transparent text-stone-500 hover:border-stone-200 hover:bg-white hover:text-stone-800'
    }`;

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{copy.workspaceTag}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{copy.title}</h2>
            <p className="text-sm leading-6 text-stone-500">
              {copy.helper}
            </p>
          </div>
          <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1 shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-stone-500">
              <CalendarDays size={14} />
              {copy.chip}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button onClick={() => setActiveTab('meals')} className={tabButtonClass('meals')} data-testid="owner-tab-meals">
            <CalendarDays size={18} />
            {copy.mealsTab}
          </button>
          <button onClick={() => setActiveTab('grocery')} className={tabButtonClass('grocery')} data-testid="owner-tab-grocery">
            <ShoppingCart size={18} />
            {copy.groceryTab}
          </button>
          <button onClick={() => setActiveTab('pantry')} className={tabButtonClass('pantry')} data-testid="owner-tab-pantry">
            <Package size={18} />
            {copy.pantryTab}
          </button>
        </div>

        <div className={panelClassName}>
          <div className="rounded-[24px] border border-stone-200/70 bg-white p-3 shadow-sm md:p-4">
            {activeTab === 'meals' && <MealPlanner meals={meals} onUpdateMeal={onUpdateMeal} />}
            {activeTab === 'grocery' && <GroceryList inventory={inventory} onUpdateInventory={onUpdateInventory} />}
            {activeTab === 'pantry' && <Pantry inventory={inventory} onAddInventoryItem={onAddInventoryItem} onUpdateInventory={onUpdateInventory} onDeleteInventoryItem={onDeleteInventoryItem} onClearAnomaly={onClearAnomaly} logs={logs} />}
          </div>
        </div>
      </div>
    </div>
  );
}
