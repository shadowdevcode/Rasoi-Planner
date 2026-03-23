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
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart size={32} className="text-orange-600" />
        <h2 className="text-3xl font-bold text-stone-800">Grocery List</h2>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="text-center py-16 bg-stone-50 rounded-2xl border border-stone-200 border-dashed">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
          <h3 className="text-xl font-bold text-stone-700">All caught up!</h3>
          <p className="text-stone-500 mt-2">Your pantry is fully stocked.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {lowStockItems.map((item) => (
              <li key={item.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${item.status === 'out' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="font-semibold text-lg text-stone-800 flex items-center gap-2">
                      <span>{item.icon}</span> {item.name}
                      {(item.requestedQuantity || item.defaultQuantity) && (
                        <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 ml-2">
                          {item.requestedQuantity || item.defaultQuantity}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-stone-500">{item.category} • {item.status === 'out' ? 'Finished' : 'Running Low'}</p>
                  </div>
                </div>
                <button
                  onClick={() => onUpdateInventory(item.id, 'in-stock')}
                  className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium hover:bg-emerald-200 transition-colors flex items-center gap-2"
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
