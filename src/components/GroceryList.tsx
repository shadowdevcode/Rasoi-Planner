import React from 'react';
import { ShoppingCart, CheckCircle2 } from 'lucide-react';
import { InventoryItem, InventoryStatus } from '../types';

interface Props {
  inventory: InventoryItem[];
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
}

export default function GroceryList({ inventory, onUpdateInventory }: Props) {
  const lowStockItems = inventory.filter((item) => item.status === 'low' || item.status === 'out');

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 rounded-[24px] border border-stone-200 bg-stone-50/80 px-4 py-4 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100">
          <ShoppingCart size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Owner Grocery List</p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-900 sm:text-3xl">Grocery List</h2>
          <p className="mt-1 text-sm text-stone-500">
            Track running-low items and mark them bought when restocked.
          </p>
        </div>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-semibold text-stone-800">All caught up</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
            Nothing is currently running low. When pantry items drop to low or out of stock, they will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          <ul className="divide-y divide-stone-100">
            {lowStockItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-stone-50 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                      item.status === 'out' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="shrink-0 text-xl">{item.icon}</span>
                      <span className="min-w-0 break-words text-lg font-semibold leading-6 text-stone-800">
                        {item.name}
                      </span>
                      {(item.requestedQuantity || item.defaultQuantity) && (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                          {item.requestedQuantity || item.defaultQuantity}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-500">
                      {item.category} • {item.status === 'out' ? 'Finished' : 'Running Low'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onUpdateInventory(item.id, 'in-stock')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-100 px-4 py-2.5 font-medium text-emerald-700 transition-colors hover:bg-emerald-200 sm:w-auto"
                >
                  <CheckCircle2 size={18} />
                  Mark Bought
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
