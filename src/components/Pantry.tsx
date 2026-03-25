import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, History, Package, Plus, Search, Trash2 } from 'lucide-react';
import { InventoryItem, InventoryStatus, PantryLog, Role, UiLanguage, UnknownIngredientQueueItem } from '../types';
import { generateId } from '../utils/id';
import { getIngredientNativeContextLabel, resolveIngredientVisual, resolveInventoryItemVisual } from '../utils/ingredientVisuals';
import { getInventoryCopy } from '../i18n/copy';
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
  unknownIngredientQueue: UnknownIngredientQueueItem[];
  onPromoteUnknownIngredient: (queueItem: UnknownIngredientQueueItem) => void;
  onDismissUnknownIngredient: (queueItem: UnknownIngredientQueueItem) => void;
  language: UiLanguage;
}

const categoryOptions = getPantryCategoryOptions();

function getStatusSelectToneClass(status: InventoryStatus): string {
  if (status === 'in-stock') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'low') {
    return 'border-yellow-200 bg-yellow-50 text-yellow-700';
  }

  return 'border-red-200 bg-red-50 text-red-700';
}

function getStatusTextToneClass(status: InventoryStatus): string {
  if (status === 'in-stock') {
    return 'text-emerald-600';
  }

  if (status === 'low') {
    return 'text-yellow-600';
  }

  return 'text-red-600';
}

function getStatusIconToneClass(status: InventoryStatus): string {
  if (status === 'in-stock') {
    return 'bg-emerald-100 text-emerald-600';
  }

  if (status === 'low') {
    return 'bg-yellow-100 text-yellow-600';
  }

  return 'bg-red-100 text-red-600';
}

function getRoleLabel(language: UiLanguage, role: Role): string {
  if (language === 'hi') {
    return role === 'owner' ? 'ओनर' : 'कुक';
  }

  return role === 'owner' ? 'Owner' : 'Cook';
}

export default function Pantry({ inventory, onAddInventoryItem, onUpdateInventory, onDeleteInventoryItem, onClearAnomaly, logs, unknownIngredientQueue, onPromoteUnknownIngredient, onDismissUnknownIngredient, language }: Props) {
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<PantryCategoryKey>('spices');
  const [newItemQuantity, setNewItemQuantity] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'inventory' | 'logs'>('inventory');
  const [failedImageIds, setFailedImageIds] = useState<Record<string, true>>({});
  const inventoryCopy = getInventoryCopy(language);
  const content = language === 'hi'
    ? {
        workspaceTag: 'ओनर वर्कस्पेस',
        title: 'पेंट्री मैनेजमेंट',
        helper: 'इन्वेंटरी ट्रैक करें, विसंगतियां साफ करें, और गतिविधि लॉग्स देखें।',
        inventoryView: 'इन्वेंटरी',
        logsView: 'एक्टिविटी लॉग्स',
        addTitle: 'नया सामान जोड़ें',
        addHelper: 'मोबाइल पर फॉर्म कॉम्पैक्ट रखें और बड़ी स्क्रीन पर आराम से भरें।',
        namePlaceholder: 'सामान का नाम (उदा: जीरा)',
        defaultSizePlaceholder: 'डिफ़ॉल्ट मात्रा (उदा: 500g)',
        addItem: 'आइटम जोड़ें',
        inventoryTitle: 'इन्वेंटरी',
        inventoryHelper: 'एक ही जगह से खोजें, अपडेट करें, वेरिफाई करें, और हटाएँ।',
        searchPlaceholder: 'पेंट्री खोजें...',
        nameColumn: 'नाम',
        categoryColumn: 'कैटेगरी',
        defaultSizeColumn: 'डिफ़ॉल्ट मात्रा',
        statusColumn: 'स्थिति',
        lastUpdatedColumn: 'आखिरी अपडेट',
        actionsColumn: 'एक्शन',
        mobileMetaLabel: 'आखिरी अपडेट',
        updatedByPrefix: 'द्वारा',
        clearWarning: 'चेतावनी साफ करें',
        deleteItem: 'आइटम हटाएँ',
        noItems: 'कोई आइटम नहीं मिला।',
        queueTitle: 'अज्ञात सामग्री समीक्षा कतार',
        queueHelper: 'कुक की नई अनमैच सामग्री रिक्वेस्ट यहां आएगी। पेंट्री में प्रमोट करें या खारिज करें।',
        queueEmpty: 'समीक्षा के लिए कोई लंबित रिक्वेस्ट नहीं है।',
        queueRequestedBy: 'रिक्वेस्ट',
        queuePromote: 'प्रमोट करें',
        queueDismiss: 'खारिज करें',
        logsTitle: 'एक्टिविटी लॉग्स',
        logsHelper: 'हाल के पेंट्री बदलाव, वेरिफिकेशन इवेंट्स, और स्टेटस अपडेट्स।',
        noLogsTitle: 'अभी कोई एक्टिविटी लॉग नहीं है।',
        noLogsHelper: 'पेंट्री आइटम में बदलाव यहां दिखाई देंगे।',
      }
    : {
        workspaceTag: 'Owner Workspace',
        title: 'Pantry Management',
        helper: 'Track inventory, resolve anomalies, and review activity without losing the table workflow.',
        inventoryView: 'Inventory',
        logsView: 'Activity Logs',
        addTitle: 'Add New Ingredient',
        addHelper: 'Keep the form compact on mobile and open it up on larger screens.',
        namePlaceholder: 'Ingredient name (e.g., Jeera)',
        defaultSizePlaceholder: 'Default Size (e.g., 500g)',
        addItem: 'Add Item',
        inventoryTitle: 'Inventory',
        inventoryHelper: 'Search, update, verify, and delete items from one place.',
        searchPlaceholder: 'Search pantry...',
        nameColumn: 'Name',
        categoryColumn: 'Category',
        defaultSizeColumn: 'Default Size',
        statusColumn: 'Status',
        lastUpdatedColumn: 'Last Updated',
        actionsColumn: 'Actions',
        mobileMetaLabel: 'Last updated',
        updatedByPrefix: 'by',
        clearWarning: 'Verify & Clear Warning',
        deleteItem: 'Delete Item',
        noItems: 'No items found.',
        queueTitle: 'Unknown Ingredient Review Queue',
        queueHelper: 'New unmatched ingredient requests from cook are collected here for owner review.',
        queueEmpty: 'No pending unknown ingredient requests.',
        queueRequestedBy: 'Requested',
        queuePromote: 'Promote',
        queueDismiss: 'Dismiss',
        logsTitle: 'Activity Logs',
        logsHelper: 'Recent pantry changes, verification events, and status updates.',
        noLogsTitle: 'No activity logs yet.',
        noLogsHelper: 'Changes to pantry items will appear here.',
      };

  const handleAddItem = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!newItemName.trim()) {
      return;
    }

    const category = normalizePantryCategory(newItemCategory);
    const visual = resolveIngredientVisual({
      name: newItemName.trim(),
      category,
    });
    const newItem: InventoryItem = {
      id: generateId(),
      name: newItemName.trim(),
      category,
      status: 'in-stock',
      icon: visual.fallbackIcon,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'owner',
      defaultQuantity: newItemQuantity || undefined,
    };

    onAddInventoryItem(newItem);
    setNewItemName('');
    setNewItemQuantity('');
  };

  const handleDeleteItem = (id: string): void => {
    const confirmed = window.confirm('Delete this pantry item? This action cannot be undone.');
    if (!confirmed) {
      return;
    }
    onDeleteInventoryItem(id);
  };

  const handleVisualImageError = (itemId: string): void => {
    setFailedImageIds((current) => {
      if (current[itemId]) {
        return current;
      }

      return {
        ...current,
        [itemId]: true,
      };
    });
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.nameHi !== undefined && item.nameHi.includes(searchTerm)) ||
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

  const renderItemVisual = (item: InventoryItem): React.ReactNode => {
    const visual = resolveInventoryItemVisual(item);
    const showImage = visual.imageUrl !== null && failedImageIds[item.id] !== true;

    if (showImage) {
      return (
        <img
          src={visual.imageUrl}
          alt={visual.altText}
          className="h-10 w-10 rounded-xl border border-stone-200 bg-white object-cover"
          loading="lazy"
          decoding="async"
          onError={() => handleVisualImageError(item.id)}
        />
      );
    }

    return (
      <span
        role="img"
        aria-label={visual.altText}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-lg leading-none"
      >
        {visual.fallbackIcon}
      </span>
    );
  };

  const renderStatusSelect = (item: InventoryItem, testId?: string): React.ReactNode => (
    <select
      value={item.status}
      onChange={(event) => onUpdateInventory(item.id, event.target.value as InventoryStatus)}
      className={`w-full rounded-full border px-3 py-2 text-sm font-medium outline-none transition ${getStatusSelectToneClass(item.status)}`}
      data-testid={testId}
    >
      <option value="in-stock">{inventoryCopy.statusLabels['in-stock']}</option>
      <option value="low">{inventoryCopy.statusLabels.low}</option>
      <option value="out">{inventoryCopy.statusLabels.out}</option>
    </select>
  );

  const renderUpdatedMeta = (item: InventoryItem): React.ReactNode => {
    if (!item.lastUpdated) {
      return <span className="text-xs text-stone-400">-</span>;
    }

    return (
      <div className="flex flex-col gap-1 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          {formatTime(item.lastUpdated)}
        </span>
        <span className="capitalize text-stone-400">
          {content.updatedByPrefix} {item.updatedBy ? getRoleLabel(language, item.updatedBy) : '-'}
        </span>
      </div>
    );
  };

  const getNativeContext = (item: InventoryItem): { label: string | null; title: string | undefined } => {
    const visual = resolveInventoryItemVisual(item);
    return {
      label: getIngredientNativeContextLabel(item, visual),
      title: visual.catalogMatch?.canonicalName,
    };
  };

  const renderActionButtons = (item: InventoryItem, className: string, clearTestId?: string, deleteTestId?: string): React.ReactNode => (
    <div className={className}>
      {item.verificationNeeded ? (
        <button
          onClick={() => onClearAnomaly(item.id)}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-200 px-3 py-2 text-emerald-700 transition-colors hover:bg-emerald-50"
          title={content.clearWarning}
          data-testid={clearTestId}
        >
          <CheckCircle2 size={18} />
        </button>
      ) : null}
      <button
        onClick={() => handleDeleteItem(item.id)}
        className="inline-flex items-center justify-center rounded-lg border border-stone-200 px-3 py-2 text-stone-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        title={content.deleteItem}
        data-testid={deleteTestId}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  const formatLogMessage = (log: PantryLog): string => {
    const roleLabel = getRoleLabel(language, log.role);

    if (language === 'hi') {
      return `${roleLabel} ने ${log.itemName} को`;
    }

    return `${roleLabel} ${inventoryCopy.logMarkedAs} ${log.itemName} as`;
  };

  const openQueueItems = unknownIngredientQueue.filter((queueItem) => queueItem.status === 'open');

  return (
    <div className="mx-auto w-full max-w-none space-y-8">
      <div className="rounded-[28px] border border-stone-200/80 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <Package size={28} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{content.workspaceTag}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">{content.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{content.helper}</p>
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
              {content.inventoryView}
            </button>
            <button
              onClick={() => setViewMode('logs')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors lg:flex-none ${
                viewMode === 'logs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
              data-testid="pantry-view-logs"
            >
              <History size={16} />
              {content.logsView}
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'inventory' ? (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-stone-900">{content.addTitle}</h3>
              <p className="text-sm text-stone-500">{content.addHelper}</p>
            </div>
            <form onSubmit={handleAddItem} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
              <input
                type="text"
                placeholder={content.namePlaceholder}
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
                placeholder={content.defaultSizePlaceholder}
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
                {content.addItem}
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm md:p-5">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-stone-900">{content.queueTitle}</h3>
                <p className="text-sm text-stone-500">{content.queueHelper}</p>
              </div>
              {openQueueItems.length === 0 ? (
                <p className="mt-4 text-sm text-stone-500">{content.queueEmpty}</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {openQueueItems.map((queueItem) => (
                    <article key={queueItem.id} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900">{queueItem.name}</p>
                          <p className="text-sm text-stone-500">{getPantryCategoryLabel(queueItem.category)}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {content.queueRequestedBy} {getRoleLabel(language, queueItem.createdBy)} • {formatTime(queueItem.createdAt)}
                          </p>
                          {queueItem.requestedQuantity ? (
                            <p className="mt-1 text-xs text-stone-500">{queueItem.requestedQuantity}</p>
                          ) : null}
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusSelectToneClass(queueItem.requestedStatus)}`}>
                          {inventoryCopy.statusLabels[queueItem.requestedStatus]}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => onPromoteUnknownIngredient(queueItem)}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                          data-testid={`unknown-queue-promote-${queueItem.id}`}
                        >
                          {content.queuePromote}
                        </button>
                        <button
                          onClick={() => onDismissUnknownIngredient(queueItem)}
                          className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100"
                          data-testid={`unknown-queue-dismiss-${queueItem.id}`}
                        >
                          {content.queueDismiss}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{content.inventoryTitle}</h3>
                <p className="text-sm text-stone-500">{content.inventoryHelper}</p>
              </div>
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input
                  type="text"
                  placeholder={content.searchPlaceholder}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-10 pr-4 text-base outline-none shadow-sm transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                  data-testid="pantry-search"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
              {filteredInventory.length === 0 ? (
                <div className="p-10 text-center text-stone-500">
                  {content.noItems}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 p-4 lg:hidden">
                    {filteredInventory.map((item) => {
                      const nativeContext = getNativeContext(item);

                      return (
                      <article key={item.id} className="rounded-[24px] border border-stone-200 bg-stone-50/60 p-4 shadow-sm" data-testid={`pantry-mobile-card-${item.id}`}>
                        <div className="flex items-start gap-3">
                          {renderItemVisual(item)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-stone-900">{item.name}</p>
                                {nativeContext.label !== null ? (
                                  <span
                                    className="mt-1 inline-flex rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-500"
                                    title={nativeContext.title}
                                  >
                                    {nativeContext.label}
                                  </span>
                                ) : null}
                                <p className="mt-1 text-sm text-stone-500">{getPantryCategoryLabel(item.category)}</p>
                              </div>
                              {item.defaultQuantity ? (
                                <span className="inline-flex shrink-0 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600">
                                  {item.defaultQuantity}
                                </span>
                              ) : null}
                            </div>
                            {item.verificationNeeded ? (
                              <span className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                                <AlertTriangle size={12} />
                                <span className="break-words">{item.anomalyReason}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 min-[540px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{content.statusColumn}</p>
                            {renderStatusSelect(item, `pantry-mobile-status-${item.id}`)}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{content.mobileMetaLabel}</p>
                            {renderUpdatedMeta(item)}
                          </div>
                        </div>

                        <div className="mt-4">
                          {renderActionButtons(item, 'flex flex-wrap gap-2', `pantry-mobile-clear-anomaly-${item.id}`, `pantry-mobile-delete-${item.id}`)}
                        </div>
                      </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto lg:block">
                    <table className="min-w-[760px] w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{content.nameColumn}</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{content.categoryColumn}</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{content.defaultSizeColumn}</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{content.statusColumn}</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{content.lastUpdatedColumn}</th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{content.actionsColumn}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredInventory.map((item) => {
                      const nativeContext = getNativeContext(item);

                      return (
                      <tr key={item.id} className="transition-colors hover:bg-stone-50/80">
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            {renderItemVisual(item)}
                            <div className="min-w-0">
                              <span className="block truncate font-semibold text-stone-900">{item.name}</span>
                              {nativeContext.label !== null ? (
                                <span
                                  className="mt-1 inline-flex rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500"
                                  title={nativeContext.title}
                                >
                                  {nativeContext.label}
                                </span>
                              ) : null}
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
                          <div className="max-w-[12rem]">
                            {renderStatusSelect(item, `pantry-status-${item.id}`)}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">{renderUpdatedMeta(item)}</td>
                        <td className="px-5 py-4 align-top text-right">
                          {renderActionButtons(item, 'flex flex-wrap justify-end gap-2', `pantry-clear-anomaly-${item.id}`, `pantry-delete-${item.id}`)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="space-y-4 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-2 border-b border-stone-100 pb-4">
            <h3 className="text-lg font-semibold text-stone-900">{content.logsTitle}</h3>
            <p className="text-sm text-stone-500">{content.logsHelper}</p>
          </div>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-stone-200 bg-stone-50 px-6 py-14 text-center text-stone-500">
              <History size={44} className="mb-4 text-stone-300" />
              <p className="text-lg font-medium text-stone-700">{content.noLogsTitle}</p>
              <p className="mt-1 text-sm">{content.noLogsHelper}</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-[24px] border border-stone-200">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-4 bg-white p-4 transition-colors hover:bg-stone-50">
                  <div className={`mt-1 rounded-full p-2 ${getStatusIconToneClass(log.newStatus)}`}>
                    <Package size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-stone-800 md:text-base">
                      <span>{formatLogMessage(log)}</span>{' '}
                      <span className={`font-semibold ${getStatusTextToneClass(log.newStatus)}`}>
                        {inventoryCopy.statusLabels[log.newStatus]}
                      </span>
                      {language === 'hi' ? <span>{' मार्क किया'}</span> : null}
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
