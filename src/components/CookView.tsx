import React, { useState } from 'react';
import { Sun, Moon, AlertCircle, CheckCircle2, Search, Mic, Info, ShoppingCart, MessageSquarePlus, Check } from 'lucide-react';
import { MealPlan, InventoryItem, InventoryStatus, UiLanguage } from '../types';
import { parseCookVoiceInput } from '../services/ai';
import { getLocalDateKey } from '../utils/date';
import { getCookCopy } from '../i18n/copy';

interface Props {
  meals: Record<string, MealPlan>;
  inventory: InventoryItem[];
  onUpdateInventory: (id: string, status: InventoryStatus, requestedQuantity?: string) => void;
  onAddUnlistedItem: (name: string, status: InventoryStatus, category: string, requestedQuantity?: string) => void;
  language: UiLanguage;
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

export default function CookView({ meals, inventory, onUpdateInventory, onAddUnlistedItem, language }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');

  const lang = language;
  const t = DICT[lang];
  const copy = getCookCopy(lang);
  const today = getLocalDateKey(new Date());
  const todaysMeals = meals[today] || { morning: t.notPlanned, evening: t.notPlanned, notes: undefined, leftovers: undefined };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.nameHi && item.nameHi.includes(searchTerm)) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const showToast = (message: string) => {
    setErrorMessage(null);
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
    setErrorMessage(null);
    try {
      const result = await parseCookVoiceInput(aiInput, inventory, lang);

      if (!result.understood) {
        setErrorMessage(result.message || (lang === 'hi' ? 'कुछ समझ नहीं आया। कृपया फिर से कोशिश करें।' : 'Could not understand. Please try again.'));
      } else {
        let updatedCount = 0;
        const inventoryIds = new Set(inventory.map((item) => item.id));
        const validUpdates = result.updates.filter((update) => inventoryIds.has(update.itemId));

        validUpdates.forEach(update => {
          onUpdateInventory(update.itemId, update.newStatus as InventoryStatus, update.requestedQuantity);
          updatedCount++;
        });

        result.unlistedItems.forEach(item => {
          onAddUnlistedItem(item.name, item.status as InventoryStatus, item.category, item.requestedQuantity);
          updatedCount++;
        });

        if (result.updates.length !== validUpdates.length) {
          setErrorMessage(lang === 'hi' ? 'कुछ आइटम मिलान नहीं हुए। बाकी अपडेट कर दिए गए।' : 'Some items could not be matched; remaining updates were applied.');
        }

        if (updatedCount > 0) {
          showToast(t.success + (result.unlistedItems.length > 0 ? ` (${result.unlistedItems.length} new items requested)` : ''));
          setAiInput('');
        } else {
          setErrorMessage(lang === 'hi' ? 'कोई बदलाव नहीं हुआ।' : 'No changes made.');
        }
      }
    } catch (error) {
      console.error('cook_ai_submit_failed', { error, aiInputLength: aiInput.length, lang });
      setErrorMessage(lang === 'hi' ? 'AI अपडेट नहीं हो पाया। दोबारा कोशिश करें।' : 'AI update failed. Please retry.');
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-8 pb-24 sm:pb-10">
      <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              {copy.workspaceTag}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              {copy.title}
            </h2>
            <p className="text-sm leading-6 text-stone-500">{copy.helper}</p>
          </div>
          <div className="inline-flex rounded-full border border-stone-200 bg-stone-50 p-1 shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold tracking-[0.08em] text-stone-500">
              <Mic size={14} />
              Cook View
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm">
            {copy.switchLabel}: {lang === 'hi' ? 'Hindi + Hinglish' : 'English + Hinglish'}
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
            <Mic size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">{copy.smartAssistant}</h3>
            <p className="text-sm text-stone-500">{copy.smartAssistantHelper}</p>
          </div>
        </div>
        <div className="rounded-[28px] border border-stone-200 bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-sm md:p-6">
          <form onSubmit={handleAiSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder={t.voicePrompt}
              data-testid="cook-ai-input"
              className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white px-4 py-3 text-stone-800 outline-none transition focus:ring-2 focus:ring-orange-200"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={isProcessing || !aiInput.trim()}
              data-testid="cook-ai-submit"
              className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-6 py-3 font-bold text-white transition-colors disabled:opacity-50 hover:bg-stone-800 sm:flex-none"
            >
              {isProcessing ? t.processing : t.voiceBtn}
            </button>
          </form>
          <p className="mt-3 text-sm text-orange-100/90">{copy.aiTip}</p>
          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              {lang === 'hi' ? 'आज का मेनू' : 'Today'}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{t.todayMenu}</h3>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex h-full flex-col rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-3 border-b border-stone-100 pb-4 text-yellow-600">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-50 ring-1 ring-yellow-100">
                <Sun size={24} />
              </div>
              <h4 className="text-xl font-semibold text-stone-900">{t.morning}</h4>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-lg font-medium leading-8 text-stone-800">
              {todaysMeals.morning || t.notPlanned}
            </p>
            {(todaysMeals.notes || todaysMeals.leftovers) && (
              <div className="mt-5 space-y-3 border-t border-stone-100 pt-5">
                {todaysMeals.notes && (
                  <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    <Info size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="mb-1 block font-semibold">{t.notes}:</span>
                      {todaysMeals.notes}
                    </div>
                  </div>
                )}
                {todaysMeals.leftovers && (
                  <div className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="mb-1 block font-semibold">{t.leftovers}:</span>
                      {todaysMeals.leftovers}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex h-full flex-col rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-3 border-b border-stone-100 pb-4 text-indigo-600">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-100">
                <Moon size={24} />
              </div>
              <h4 className="text-xl font-semibold text-stone-900">{t.evening}</h4>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-lg font-medium leading-8 text-stone-800">
              {todaysMeals.evening || t.notPlanned}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              {lang === 'hi' ? 'पेंट्री चेक' : 'Pantry'}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{t.pantryCheck}</h3>
          </div>
        </div>
        <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-stone-500">{t.pantryDesc}</p>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="text"
                placeholder={t.search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="cook-pantry-search"
                className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredInventory.map((item) => (
              <div key={item.id} className="flex h-full flex-col gap-4 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="break-words text-lg font-semibold leading-tight text-stone-900">
                        {lang === 'hi' && item.nameHi ? item.nameHi : item.name}
                      </p>
                      {lang === 'hi' && <p className="break-words text-sm text-stone-500">{item.name}</p>}
                    </div>
                  </div>
                  {(item.status === 'low' || item.status === 'out') && (
                    <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">
                      <ShoppingCart size={14} />
                      <span className="whitespace-nowrap">{t.onList}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    onClick={() => handleStatusUpdate(item.id, 'in-stock', item.name, item.nameHi)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                      item.status === 'in-stock'
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                        : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    {t.inStock}
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(item.id, 'low', item.name, item.nameHi)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                      item.status === 'low'
                        ? 'border-yellow-200 bg-yellow-100 text-yellow-700'
                        : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    {t.low}
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(item.id, 'out', item.name, item.nameHi)}
                    className={`rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                      item.status === 'out'
                        ? 'border-red-200 bg-red-100 text-red-700'
                        : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    {t.out}
                  </button>
                </div>

                {(item.status === 'low' || item.status === 'out') && (
                  <div className="mt-1">
                    {editingNoteId === item.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={noteValue}
                          onChange={(e) => setNoteValue(e.target.value)}
                          placeholder={lang === 'hi' ? 'कितना चाहिए? (उदा: 2kg)' : 'Quantity? (e.g. 2kg)'}
                          className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNote(item.id, item.status)}
                          className="inline-flex items-center justify-center rounded-xl bg-stone-900 p-2 text-white transition-colors hover:bg-stone-800 sm:flex-none"
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
                        className="flex w-full items-center gap-2 py-1 text-sm text-stone-500 transition-colors hover:text-stone-800"
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
        </div>
      </section>

      {toastMessage && (
        <div className="fixed left-1/2 top-4 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-top-4 sm:top-auto sm:bottom-6 sm:translate-y-0 sm:slide-in-from-bottom-4">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
