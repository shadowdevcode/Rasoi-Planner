import React, { useRef, useState } from 'react';
import { CalendarDays, ShoppingCart, Package } from 'lucide-react';
import { MealPlan, InventoryItem, InventoryStatus, PantryLog, UiLanguage, UnknownIngredientQueueItem } from '../types';
import MealPlanner from './MealPlanner';
import GroceryList from './GroceryList';
import Pantry from './Pantry';
import { getInventoryCopy, getOwnerCopy } from '../i18n/copy';

type OwnerTab = 'meals' | 'grocery' | 'pantry';

const ownerTabs: OwnerTab[] = ['meals', 'grocery', 'pantry'];

function getOwnerTabId(tab: OwnerTab): string {
  return `owner-tab-${tab}`;
}

function getOwnerPanelId(tab: OwnerTab): string {
  return `owner-panel-${tab}`;
}

interface Props {
  meals: Record<string, MealPlan>;
  onUpdateMeal: (dateStr: string, field: keyof MealPlan, value: string) => void;
  inventory: InventoryItem[];
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
  onDeleteInventoryItem: (id: string) => void;
  onClearAnomaly: (id: string) => void;
  logs: PantryLog[];
  unknownIngredientQueue: UnknownIngredientQueueItem[];
  onPromoteUnknownIngredient: (queueItem: UnknownIngredientQueueItem) => void;
  onDismissUnknownIngredient: (queueItem: UnknownIngredientQueueItem) => void;
  language: UiLanguage;
}

export default function OwnerView({ meals, onUpdateMeal, inventory, onAddInventoryItem, onUpdateInventory, onDeleteInventoryItem, onClearAnomaly, logs, unknownIngredientQueue, onPromoteUnknownIngredient, onDismissUnknownIngredient, language }: Props) {
  const [activeTab, setActiveTab] = useState<OwnerTab>('meals');
  const tabRefs = useRef<Record<OwnerTab, HTMLButtonElement | null>>({
    meals: null,
    grocery: null,
    pantry: null,
  });
  const copy = getOwnerCopy(language);
  const inventoryCopy = getInventoryCopy(language);
  const groceryPendingCount = inventory.filter((item) => item.status === 'low' || item.status === 'out').length;
  const pantryAnomalyCount = inventory.filter((item) => item.verificationNeeded === true).length;
  const unknownQueueOpenCount = unknownIngredientQueue.filter((item) => item.status === 'open').length;
  const pantryAttentionCount = pantryAnomalyCount + unknownQueueOpenCount;
  const panelClassName = 'min-h-[600px] rounded-[28px] border border-stone-200/80 bg-stone-50/60 p-3 shadow-sm md:p-4';
  const tabButtonClass = (tab: OwnerTab): string =>
    `flex min-w-0 items-center justify-center gap-2 rounded-[20px] border px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 md:px-5 ${
      activeTab === tab
        ? 'border-orange-200 bg-white text-orange-800 shadow-sm ring-1 ring-orange-100'
        : 'border-transparent bg-transparent text-stone-500 hover:border-stone-200 hover:bg-white/90 hover:text-stone-800'
    }`;
  const counterClassName = (count: number): string =>
    `inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
      count > 0 ? 'bg-orange-100 text-orange-700' : 'bg-stone-200 text-stone-500'
    }`;

  const setAndFocusTab = (tab: OwnerTab): void => {
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  };

  const handleTabKeyDown = (tab: OwnerTab, event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const currentIndex = ownerTabs.indexOf(tab);
    let nextTab: OwnerTab | null = null;

    if (event.key === 'ArrowRight') {
      nextTab = ownerTabs[(currentIndex + 1) % ownerTabs.length];
    }

    if (event.key === 'ArrowLeft') {
      nextTab = ownerTabs[(currentIndex - 1 + ownerTabs.length) % ownerTabs.length];
    }

    if (event.key === 'Home') {
      nextTab = ownerTabs[0];
    }

    if (event.key === 'End') {
      nextTab = ownerTabs[ownerTabs.length - 1];
    }

    if (nextTab === null) {
      return;
    }

    event.preventDefault();
    setAndFocusTab(nextTab);
  };

  const renderPanelContent = (tab: OwnerTab): React.ReactNode => {
    if (tab === 'meals') {
      return <MealPlanner meals={meals} onUpdateMeal={onUpdateMeal} />;
    }

    if (tab === 'grocery') {
      return <GroceryList inventory={inventory} onUpdateInventory={onUpdateInventory} language={language} />;
    }

    return (
      <Pantry
        inventory={inventory}
        onAddInventoryItem={onAddInventoryItem}
        onUpdateInventory={onUpdateInventory}
        onDeleteInventoryItem={onDeleteInventoryItem}
        onClearAnomaly={onClearAnomaly}
        logs={logs}
        unknownIngredientQueue={unknownIngredientQueue}
        onPromoteUnknownIngredient={onPromoteUnknownIngredient}
        onDismissUnknownIngredient={onDismissUnknownIngredient}
        language={language}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{copy.workspaceTag}</p>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{copy.title}</h2>
            <p className="max-w-xl text-sm leading-6 text-stone-500">{copy.helper}</p>
          </div>
          <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1 shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-stone-500">
              <CalendarDays size={14} />
              {copy.chip}
            </span>
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-stone-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm md:p-4">
        <div
          className="grid grid-cols-1 gap-2 rounded-[24px] border border-stone-200/80 bg-stone-100/80 p-1.5 sm:grid-cols-3"
          role="tablist"
          aria-label={copy.workspaceTag}
        >
          <button
            onClick={() => setActiveTab('meals')}
            className={tabButtonClass('meals')}
            data-testid="owner-tab-meals"
            id={getOwnerTabId('meals')}
            role="tab"
            aria-selected={activeTab === 'meals'}
            aria-controls={getOwnerPanelId('meals')}
            tabIndex={activeTab === 'meals' ? 0 : -1}
            onKeyDown={(event) => handleTabKeyDown('meals', event)}
            ref={(element) => {
              tabRefs.current.meals = element;
            }}
          >
            <CalendarDays size={18} />
            {copy.mealsTab}
          </button>
          <button
            onClick={() => setActiveTab('grocery')}
            className={tabButtonClass('grocery')}
            data-testid="owner-tab-grocery"
            id={getOwnerTabId('grocery')}
            role="tab"
            aria-selected={activeTab === 'grocery'}
            aria-controls={getOwnerPanelId('grocery')}
            tabIndex={activeTab === 'grocery' ? 0 : -1}
            aria-label={`${copy.groceryTab}, ${groceryPendingCount} ${inventoryCopy.groceryPendingCountLabel}`}
            onKeyDown={(event) => handleTabKeyDown('grocery', event)}
            ref={(element) => {
              tabRefs.current.grocery = element;
            }}
          >
            <ShoppingCart size={18} />
            <span className="truncate">{copy.groceryTab}</span>
            <span className={counterClassName(groceryPendingCount)} aria-hidden="true">
              {groceryPendingCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('pantry')}
            className={tabButtonClass('pantry')}
            data-testid="owner-tab-pantry"
            id={getOwnerTabId('pantry')}
            role="tab"
            aria-selected={activeTab === 'pantry'}
            aria-controls={getOwnerPanelId('pantry')}
            tabIndex={activeTab === 'pantry' ? 0 : -1}
            aria-label={`${copy.pantryTab}, ${pantryAttentionCount} ${inventoryCopy.pantryReviewItemsCountLabel}`}
            onKeyDown={(event) => handleTabKeyDown('pantry', event)}
            ref={(element) => {
              tabRefs.current.pantry = element;
            }}
          >
            <Package size={18} />
            <span className="truncate">{copy.pantryTab}</span>
            <span className={counterClassName(pantryAnomalyCount)} aria-hidden="true">
              {pantryAttentionCount}
            </span>
          </button>
        </div>

        {ownerTabs.map((tab) => (
          <div
            key={tab}
            id={getOwnerPanelId(tab)}
            className={activeTab === tab ? `mt-3 ${panelClassName}` : 'hidden'}
            role="tabpanel"
            aria-labelledby={getOwnerTabId(tab)}
            hidden={activeTab !== tab}
            tabIndex={0}
          >
            {activeTab === tab ? (
              <div className="rounded-[24px] border border-stone-200/70 bg-white p-3 shadow-sm md:p-4">
                {renderPanelContent(tab)}
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
