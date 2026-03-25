import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, History, Package, Plus, Search, Trash2 } from 'lucide-react';
import { InventoryItem, InventoryStatus, PantryLog } from '../types';
import { generateId } from '../utils/id';
import {
  getPantryCategoryLabel,
  getPantryCategoryOptions,
  normalizePantryCategory,
  pantryCategoryMatchesSearch,
  type PantryCategoryKey,
} from '../utils/pantryCategory';

interface Props {
  inventory: InventoryItem[];
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
  onDeleteInventoryItem: (id: string) => void;
  onClearAnomaly: (id: string) => void;
  logs: PantryLog[];
}

const categoryOptions = getPantryCategoryOptions();

export default function Pantry({ inventory, onAddInventoryItem, onUpdateInventory, onDeleteInventoryItem, onClearAnomaly, logs }: Props) {
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<PantryCategoryKey>('spices');
  const [newItemQuantity, setNewItemQuantity] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'inventory' | 'logs'>('inventory');

  const handleAddItem = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!newItemName.trim()) {
      return;
    }

    const newItem: InventoryItem = {
      id: generateId(),
      name: newItemName.trim(),
      category: newItemCategory,
      status: 'in-stock',
      icon: '📦',
      lastUpdated: new Date().toISOString(),
      updatedBy: 'owner',
      defaultQuantity: newItemQuantity || undefined,
    };

    onAddInventoryItem(newItem);
    setNewItemName('');
    setNewItemQuantity('');
  };

  const handleDeleteItem = (id: string): void => {
    onDeleteInventoryItem(id);
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pantryCategoryMatchesSearch(item.category, searchTerm),
  );

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mx-auto w-full max-w-none space-y-8">
      <div className="rounded-[28px] border border-stone-200/80 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <Package size={28} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Owner Workspace</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Pantry Management</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                Track inventory, resolve anomalies, and review activity without losing the table workflow.
              </p>
            </div>
          </div>

          <div className="inline-flex w-full rounded-full border border-stone-200 bg-stone-50 p-1 shadow-sm lg:w-auto">
            <button
              onClick={() => setViewMode('inventory')}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors lg:flex-none ${
                viewMode === 'inventory' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
              data-testid="pantry-view-inventory"
            >
              Inventory
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors lg:flex-none ${
                viewMode === 'logs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
              data-testid="pantry-view-logs"
            >
              <History size={16} />
              Activity Logs
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'inventory' ? (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-stone-900">Add New Ingredient</h3>
              <p className="text-sm text-stone-500">Keep the form compact on mobile and open it up on larger screens.</p>
            </div>
            <form onSubmit={handleAddItem} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
              <input
                type="text"
                placeholder="Ingredient name (e.g., Jeera)"
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                data-testid="pantry-new-item-name"
              />
              <select
                value={newItemCategory}
                onChange={(event) => setNewItemCategory(normalizePantryCategory(event.target.value))}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                data-testid="pantry-new-item-category"
              >
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Default Size (e.g., 500g)"
                value={newItemQuantity}
                onChange={(event) => setNewItemQuantity(event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                data-testid="pantry-new-item-quantity"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
                data-testid="pantry-add-item"
              >
                <Plus size={18} />
                Add Item
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">Inventory Table</h3>
                <p className="text-sm text-stone-500">Search, update, verify, and delete items from one place.</p>
              </div>
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  placeholder="Search pantry..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-10 pr-4 text-base outline-none shadow-sm transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  data-testid="pantry-search"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Name</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Category</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Default Size</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Status</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Last Updated</th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-stone-50/80">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className="text-xl leading-none">{item.icon}</span>
                            <div className="min-w-0">
                              <span className="block truncate font-semibold text-stone-900">{item.name}</span>
                              {item.verificationNeeded ? (
                                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
                                  <AlertTriangle size={12} />
                                  <span className="truncate">{item.anomalyReason}</span>
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-stone-500">{getPantryCategoryLabel(item.category)}</td>
                        <td className="px-5 py-4 text-sm text-stone-500">{item.defaultQuantity || '-'}</td>
                        <td className="px-5 py-4">
                          <select
                            value={item.status}
                            onChange={(event) => onUpdateInventory(item.id, event.target.value as InventoryStatus)}
                            className={`w-full rounded-full border px-3 py-2 text-sm font-medium outline-none transition sm:w-auto ${
                              item.status === 'in-stock'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : item.status === 'low'
                                  ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
                                  : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                            data-testid={`pantry-status-${item.id}`}
                          >
                            <option value="in-stock">In Stock</option>
                            <option value="low">Running Low</option>
                            <option value="out">Finished</option>
                          </select>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {item.lastUpdated ? (
                            <div className="flex flex-col gap-1 text-xs text-stone-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatTime(item.lastUpdated)}
                              </span>
                              <span className="capitalize text-stone-400">by {item.updatedBy}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-stone-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {item.verificationNeeded ? (
                              <button
                                onClick={() => onClearAnomaly(item.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-emerald-200 px-3 py-2 text-emerald-700 transition-colors hover:bg-emerald-50"
                                title="Verify & Clear Warning"
                                data-testid={`pantry-clear-anomaly-${item.id}`}
                              >
                                <CheckCircle2 size={18} />
                              </button>
                            ) : null}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="inline-flex items-center justify-center rounded-lg border border-stone-200 px-3 py-2 text-stone-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              title="Delete Item"
                              data-testid={`pantry-delete-${item.id}`}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredInventory.length === 0 ? (
                <div className="p-10 text-center text-stone-500">
                  No items found.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <section className="space-y-4 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-2 border-b border-stone-100 pb-4">
            <h3 className="text-lg font-semibold text-stone-900">Activity Logs</h3>
            <p className="text-sm text-stone-500">Recent pantry changes, verification events, and status updates.</p>
          </div>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-stone-50 px-6 py-14 text-center text-stone-500">
              <History size={44} className="mb-4 text-stone-300" />
              <p className="text-lg font-medium text-stone-700">No activity logs yet.</p>
              <p className="mt-1 text-sm">Changes to pantry items will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-[24px] border border-stone-200">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-4 bg-white p-4 transition-colors hover:bg-stone-50">
                  <div
                    className={`mt-1 rounded-full p-2 ${
                      log.newStatus === 'in-stock'
                        ? 'bg-emerald-100 text-emerald-600'
                        : log.newStatus === 'low'
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-red-100 text-red-600'
                    }`}
                  >
                    <Package size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-stone-800 md:text-base">
                      <span className="font-semibold capitalize">{log.role}</span> marked <span className="font-semibold">{log.itemName}</span> as{' '}
                      <span
                        className={`font-semibold ${
                          log.newStatus === 'in-stock'
                            ? 'text-emerald-600'
                            : log.newStatus === 'low'
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {log.newStatus === 'in-stock' ? 'In Stock' : log.newStatus === 'low' ? 'Running Low' : 'Finished'}
                      </span>
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                      <Clock size={14} />
                      {formatTime(log.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
