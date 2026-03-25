import React from 'react';
import { ShoppingCart, CheckCircle2 } from 'lucide-react';
import { InventoryItem, InventoryStatus, UiLanguage } from '../types';
import { getIngredientNativeContextLabel, resolveInventoryItemVisual } from '../utils/ingredientVisuals';
import { getPantryCategoryLabel } from '../utils/pantryCategory';
import { getInventoryCopy } from '../i18n/copy';

interface Props {
  inventory: InventoryItem[];
  onUpdateInventory: (id: string, status: InventoryStatus) => void;
  language: UiLanguage;
}

export default function GroceryList({ inventory, onUpdateInventory, language }: Props) {
  const [failedImageIds, setFailedImageIds] = React.useState<Record<string, true>>({});
  const lowStockItems = inventory.filter((item) => item.status === 'low' || item.status === 'out');
  const inventoryCopy = getInventoryCopy(language);
  const content = language === 'hi'
    ? {
        tag: 'ओनर किराना सूची',
        title: 'किराना सूची',
        helper: 'जो सामान कम हो रहा है या खत्म हो गया है, उसे यहां ट्रैक करें और भरने के बाद अपडेट करें।',
        emptyTitle: 'अभी सब ठीक है',
        emptyHelper: 'जब कोई आइटम कम होगा या खत्म होगा, वह यहां दिखेगा।',
      }
    : {
        tag: 'Owner Grocery List',
        title: 'Grocery List',
        helper: 'Track items that are running low or out of stock, then update them once restocked.',
        emptyTitle: 'All caught up',
        emptyHelper: 'Nothing is currently running low. When pantry items drop to running low or out of stock, they will appear here.',
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

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 rounded-[24px] border border-stone-200 bg-stone-50/80 px-4 py-4 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100">
          <ShoppingCart size={24} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{content.tag}</p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-900 sm:text-3xl">{content.title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-500">{content.helper}</p>
        </div>
      </div>

      {lowStockItems.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-semibold text-stone-800">{content.emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{content.emptyHelper}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          <ul className="divide-y divide-stone-100">
            {lowStockItems.map((item) => {
              const visual = resolveInventoryItemVisual(item);
              const nativeContext = getIngredientNativeContextLabel(item, visual);
              const showImage = visual.imageUrl !== null && failedImageIds[item.id] !== true;

              return (
              <li
                key={item.id}
                className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-stone-50 sm:px-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                      item.status === 'out' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {showImage ? (
                        <img
                          src={visual.imageUrl}
                          alt={visual.altText}
                          className="h-10 w-10 shrink-0 rounded-xl border border-stone-200 bg-white object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={() => handleVisualImageError(item.id)}
                        />
                      ) : (
                        <span
                          role="img"
                          aria-label={visual.altText}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-lg leading-none"
                        >
                          {visual.fallbackIcon}
                        </span>
                      )}
                      <span className="min-w-0 break-words text-lg font-semibold leading-6 text-stone-800">
                        {item.name}
                      </span>
                      {(item.requestedQuantity || item.defaultQuantity) && (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                          {item.requestedQuantity || item.defaultQuantity}
                        </span>
                      )}
                    </div>
                    {nativeContext !== null ? (
                      <span
                        className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500"
                        title={visual.catalogMatch?.canonicalName}
                      >
                        {nativeContext}
                      </span>
                    ) : null}
                    <p className="text-sm leading-6 text-stone-500">
                      {getPantryCategoryLabel(item.category)} • {inventoryCopy.statusLabels[item.status]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onUpdateInventory(item.id, 'in-stock')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-100 px-4 py-2.5 text-center font-medium text-emerald-700 transition-colors hover:bg-emerald-200 md:w-auto"
                  data-testid={`grocery-mark-bought-${item.id}`}
                >
                  <CheckCircle2 size={18} />
                  {inventoryCopy.markRestocked}
                </button>
              </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
