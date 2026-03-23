import React, { useState } from 'react';
import { Sun, Moon, AlertCircle, CheckCircle2, Search, Mic, Globe, Info, ShoppingCart, MessageSquarePlus, Check } from 'lucide-react';
import { MealPlan, InventoryItem, InventoryStatus, Language } from '../types';
import { parseCookVoiceInput } from '../services/ai';

interface Props {
  meals: Record<string, MealPlan>;
  inventory: InventoryItem[];
  onUpdateInventory: (id: string, status: InventoryStatus, requestedQuantity?: string) => void;
  onAddUnlistedItem: (name: string, status: InventoryStatus, category: string, requestedQuantity?: string) => void;
}

const DICT = {
  en: {
    todayMenu: "Today's Menu",
    morning: "Morning + Lunch",
    evening: "Evening (6 PM)",
    notes: "Special Instructions",
    leftovers: "Use Leftovers",
    pantryCheck: "Pantry Check",
    pantryDesc: "Mark items that are running low or finished.",
    search: "Search ingredients...",
    inStock: "Full",
    low: "Low",
    out: "Empty",
    voicePrompt: "Tell AI what's finished...",
    voiceBtn: "Update",
    notPlanned: "Not planned",
    success: "Updated successfully!",
    processing: "Processing...",
    onList: "On List",
    addNote: "Add Note",
    save: "Save",
  },
  hi: {
    todayMenu: "आज का मेनू",
    morning: "सुबह + दोपहर का खाना",
    evening: "शाम (6 बजे)",
    notes: "विशेष निर्देश",
    leftovers: "बचा हुआ खाना इस्तेमाल करें",
    pantryCheck: "राशन चेक करें",
    pantryDesc: "जो सामान कम है या खत्म हो गया है, उसे मार्क करें।",
    search: "सामान खोजें...",
    inStock: "पूरा है",
    low: "कम है",
    out: "खत्म",
    voicePrompt: "AI को बताएं क्या खत्म हुआ...",
    voiceBtn: "अपडेट करें",
    notPlanned: "तय नहीं है",
    success: "अपडेट हो गया!",
    processing: "प्रोसेस हो रहा है...",
    onList: "सूची में है",
    addNote: "नोट लिखें",
    save: "सेव",
  }
};

export default function CookView({ meals, inventory, onUpdateInventory, onAddUnlistedItem }: Props) {
  const [lang, setLang] = useState<Language>('hi');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');

  const t = DICT[lang];
  const today = new Date().toISOString().split('T')[0];
  const todaysMeals = meals[today] || { morning: t.notPlanned, evening: t.notPlanned, notes: undefined, leftovers: undefined };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.nameHi && item.nameHi.includes(searchTerm)) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStatusUpdate = (id: string, status: InventoryStatus, itemName: string, itemHiName?: string) => {
    onUpdateInventory(id, status);
    
    // If marking as in-stock, clear any editing note state
    if (status === 'in-stock' && editingNoteId === id) {
      setEditingNoteId(null);
      setNoteValue('');
    }
    
    let statusText = '';
    if (status === 'in-stock') statusText = t.inStock;
    if (status === 'low') statusText = t.low;
    if (status === 'out') statusText = t.out;
    
    const displayName = lang === 'hi' && itemHiName ? itemHiName : itemName;
    showToast(`${displayName} ➔ ${statusText}`);
  };

  const handleSaveNote = (id: string, status: InventoryStatus) => {
    onUpdateInventory(id, status, noteValue);
    setEditingNoteId(null);
    setNoteValue('');
    showToast(lang === 'hi' ? 'नोट सेव हो गया' : 'Note saved');
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    
    setIsProcessing(true);
    const result = await parseCookVoiceInput(aiInput, inventory, lang);
    
    if (!result.understood) {
      alert(result.message || (lang === 'hi' ? 'कुछ समझ नहीं आया। कृपया फिर से कोशिश करें।' : 'Could not understand. Please try again.'));
    } else {
      let updatedCount = 0;
      result.updates.forEach(update => {
        onUpdateInventory(update.itemId, update.newStatus as InventoryStatus, update.requestedQuantity);
        updatedCount++;
      });
      
      result.unlistedItems.forEach(item => {
        onAddUnlistedItem(item.name, item.status as InventoryStatus, item.category, item.requestedQuantity);
        updatedCount++;
      });

      if (updatedCount > 0) {
        alert(t.success + (result.unlistedItems.length > 0 ? ` (${result.unlistedItems.length} new items requested)` : ''));
        setAiInput('');
      } else {
        alert(lang === 'hi' ? 'कोई बदलाव नहीं हुआ।' : 'No changes made.');
      }
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-8">
      {/* Header Controls */}
      <div className="flex justify-end">
        <button
          onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-semibold shadow-sm hover:bg-stone-50 transition-colors"
        >
          <Globe size={16} className="text-orange-600" />
          {lang === 'en' ? 'हिंदी में देखें' : 'View in English'}
        </button>
      </div>

      {/* Today's Menu */}
      <section>
        <h2 className="text-2xl font-bold text-stone-800 mb-4">{t.todayMenu}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Morning + Lunch */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-t-yellow-400 border border-stone-200">
            <div className="flex items-center gap-3 mb-4 text-yellow-600">
              <Sun size={28} />
              <h3 className="text-xl font-bold">{t.morning}</h3>
            </div>
            <p className="text-lg text-stone-800 font-medium whitespace-pre-wrap mb-4">
              {todaysMeals.morning || t.notPlanned}
            </p>
            
            {(todaysMeals.notes || todaysMeals.leftovers) && (
              <div className="pt-4 border-t border-stone-100 space-y-3">
                {todaysMeals.notes && (
                  <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm flex gap-2">
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-1">{t.notes}:</span>
                      {todaysMeals.notes}
                    </div>
                  </div>
                )}
                {todaysMeals.leftovers && (
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-sm flex gap-2">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-1">{t.leftovers}:</span>
                      {todaysMeals.leftovers}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Evening */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border-t-4 border-t-indigo-500 border border-stone-200">
            <div className="flex items-center gap-3 mb-4 text-indigo-600">
              <Moon size={28} />
              <h3 className="text-xl font-bold">{t.evening}</h3>
            </div>
            <p className="text-lg text-stone-800 font-medium whitespace-pre-wrap mb-4">
              {todaysMeals.evening || t.notPlanned}
            </p>
          </div>
        </div>
      </section>

      {/* AI Voice Assistant Simulation */}
      <section className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 shadow-md text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2 rounded-full">
            <Mic size={24} />
          </div>
          <h3 className="text-xl font-bold">Smart Assistant</h3>
        </div>
        <form onSubmit={handleAiSubmit} className="flex gap-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder={t.voicePrompt}
            className="flex-grow px-4 py-3 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !aiInput.trim()}
            className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {isProcessing ? t.processing : t.voiceBtn}
          </button>
        </form>
        <p className="text-sm text-orange-100 mt-3 opacity-80">
          Tip: Type something like "Tamatar aur atta khatam ho gaya hai"
        </p>
      </section>

      {/* Pantry Quick Update */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">{t.pantryCheck}</h2>
            <p className="text-stone-500">{t.pantryDesc}</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              placeholder={t.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4 rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <p className="font-bold text-stone-800 text-lg leading-tight">
                      {lang === 'hi' && item.nameHi ? item.nameHi : item.name}
                    </p>
                    {lang === 'hi' && <p className="text-sm text-stone-500">{item.name}</p>}
                  </div>
                </div>
                {(item.status === 'low' || item.status === 'out') && (
                  <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100">
                    <ShoppingCart size={14} />
                    <span className="hidden sm:inline">{t.onList}</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  onClick={() => handleStatusUpdate(item.id, 'in-stock', item.name, item.nameHi)}
                  className={`py-2 px-1 rounded-lg text-sm font-bold transition-colors border ${
                    item.status === 'in-stock' 
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-700' 
                      : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  {t.inStock}
                </button>
                <button
                  onClick={() => handleStatusUpdate(item.id, 'low', item.name, item.nameHi)}
                  className={`py-2 px-1 rounded-lg text-sm font-bold transition-colors border ${
                    item.status === 'low' 
                      ? 'bg-yellow-100 border-yellow-200 text-yellow-700' 
                      : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  {t.low}
                </button>
                <button
                  onClick={() => handleStatusUpdate(item.id, 'out', item.name, item.nameHi)}
                  className={`py-2 px-1 rounded-lg text-sm font-bold transition-colors border ${
                    item.status === 'out' 
                      ? 'bg-red-100 border-red-200 text-red-700' 
                      : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  {t.out}
                </button>
              </div>

              {/* Note / Quantity Section */}
              {(item.status === 'low' || item.status === 'out') && (
                <div className="mt-1">
                  {editingNoteId === item.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        placeholder={lang === 'hi' ? 'कितना चाहिए? (उदा: 2kg)' : 'Quantity? (e.g. 2kg)'}
                        className="flex-grow px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveNote(item.id, item.status)}
                        className="bg-stone-800 text-white p-2 rounded-lg hover:bg-stone-700 transition-colors"
                        title={t.save}
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingNoteId(item.id);
                        setNoteValue(item.requestedQuantity || '');
                      }}
                      className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800 transition-colors py-1 w-full"
                    >
                      <MessageSquarePlus size={16} />
                      {item.requestedQuantity ? (
                        <span className="font-medium text-stone-700">
                          {lang === 'hi' ? 'नोट:' : 'Note:'} {item.requestedQuantity}
                        </span>
                      ) : (
                        <span>{t.addNote}</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-3 rounded-full shadow-xl font-medium text-sm z-50 animate-in fade-in slide-in-from-bottom-4">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
