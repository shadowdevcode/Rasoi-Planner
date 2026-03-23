import React, { useState } from 'react';
import { Package, Plus, Trash2, Search, History, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { InventoryItem, InventoryStatus, PantryLog } from '../types';

interface Props {
  inventory: InventoryItem[];
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
  onDeleteInventoryItem: (id: string) => void;
  onClearAnomaly: (id: string) => void;
  logs: PantryLog[];
}

export default function Pantry({ inventory, onAddInventoryItem, onUpdateInventory, onDeleteInventoryItem, onClearAnomaly, logs }: Props) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Spices');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'inventory' | 'logs'>('inventory');

  const categories = ['Spices', 'Pulses', 'Staples', 'Veggies', 'Dairy', 'Other'];

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: InventoryItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      category: newItemCategory,
      status: 'in-stock',
      icon: '📦', // Default icon
      lastUpdated: new Date().toISOString(),
      updatedBy: 'owner',
      defaultQuantity: newItemQuantity || undefined
    };

    onAddInventoryItem(newItem);
    setNewItemName('');
    setNewItemQuantity('');
  };

  const handleDeleteItem = (id: string) => {
    onDeleteInventoryItem(id);
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Package size={32} className="text-orange-600" />
          <h2 className="text-3xl font-bold text-stone-800">Pantry Management</h2>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('inventory')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'inventory' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setViewMode('logs')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'logs' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <History size={16} />
            Activity Logs
          </button>
        </div>
      </div>

      {viewMode === 'inventory' ? (
        <>
          {/* Add New Item */}
          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 shadow-sm">
            <h3 className="text-lg font-bold text-stone-800 mb-4">Add New Ingredient</h3>
            <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Ingredient name (e.g., Jeera)"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="flex-grow px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
              <select
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Default Size (e.g., 500g)"
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(e.target.value)}
                className="w-full md:w-48 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
              <button
                type="submit"
                className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Item
              </button>
            </form>
          </div>

          {/* Search and List */}
          <div>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
              <input
                type="text"
                placeholder="Search pantry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none shadow-sm text-lg"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200">
                      <th className="p-4 font-bold text-stone-600 uppercase text-xs tracking-wider">Name</th>
                      <th className="p-4 font-bold text-stone-600 uppercase text-xs tracking-wider">Category</th>
                      <th className="p-4 font-bold text-stone-600 uppercase text-xs tracking-wider">Default Size</th>
                      <th className="p-4 font-bold text-stone-600 uppercase text-xs tracking-wider">Status</th>
                      <th className="p-4 font-bold text-stone-600 uppercase text-xs tracking-wider">Last Updated</th>
                      <th className="p-4 font-bold text-stone-600 uppercase text-xs tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{item.icon}</span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-stone-800">{item.name}</span>
                              {item.verificationNeeded && (
                                <span className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle size={12} /> {item.anomalyReason}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-stone-500 text-sm">{item.category}</td>
                        <td className="p-4 text-stone-500 text-sm">{item.defaultQuantity || '-'}</td>
                        <td className="p-4">
                          <select
                            value={item.status}
                            onChange={(e) => onUpdateInventory(item.id, e.target.value as InventoryStatus)}
                            className={`px-3 py-1 rounded-full text-sm font-medium border outline-none ${
                              item.status === 'in-stock'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'low'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            <option value="in-stock">In Stock</option>
                            <option value="low">Running Low</option>
                            <option value="out">Finished</option>
                          </select>
                        </td>
                        <td className="p-4">
                          {item.lastUpdated ? (
                            <div className="text-xs text-stone-500 flex flex-col">
                              <span className="flex items-center gap-1"><Clock size={12}/> {formatTime(item.lastUpdated)}</span>
                              <span className="capitalize text-stone-400">by {item.updatedBy}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-stone-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1">
                            {item.verificationNeeded && (
                              <button
                                onClick={() => onClearAnomaly(item.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Verify & Clear Warning"
                              >
                                <CheckCircle2 size={20} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredInventory.length === 0 && (
                <div className="p-8 text-center text-stone-500">
                  No items found.
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Logs View */
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-stone-500 flex flex-col items-center">
              <History size={48} className="text-stone-300 mb-4" />
              <p className="text-lg font-medium">No activity logs yet.</p>
              <p className="text-sm">Changes to pantry items will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {logs.map((log) => (
                <li key={log.id} className="p-4 hover:bg-stone-50 transition-colors flex items-start gap-4">
                  <div className={`p-2 rounded-full mt-1 ${
                    log.newStatus === 'in-stock' ? 'bg-emerald-100 text-emerald-600' :
                    log.newStatus === 'low' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    <Package size={20} />
                  </div>
                  <div className="flex-grow">
                    <p className="text-stone-800">
                      <span className="font-semibold capitalize">{log.role}</span> marked <span className="font-bold">{log.itemName}</span> as{' '}
                      <span className={`font-semibold ${
                        log.newStatus === 'in-stock' ? 'text-emerald-600' :
                        log.newStatus === 'low' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {log.newStatus === 'in-stock' ? 'In Stock' : log.newStatus === 'low' ? 'Running Low' : 'Finished'}
                      </span>
                    </p>
                    <p className="text-sm text-stone-500 flex items-center gap-1 mt-1">
                      <Clock size={14} /> {formatTime(log.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
