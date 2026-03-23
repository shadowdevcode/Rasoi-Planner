interface InventoryPromptItem {
  id: string;
  name: string;
  nameHi?: string;
}

interface ParseRequestBody {
  input: string;
  inventory: InventoryPromptItem[];
  lang: 'en' | 'hi';
}

const ITEM_ALIASES: Record<string, string[]> = {
  tomatoes: ['tamatar', 'tomato', 'tomatoes'],
  atta: ['atta', 'flour', 'wheat flour', 'aata'],
  milk: ['milk', 'doodh'],
};

function parseRequestedQuantity(input: string): string | undefined {
  const quantityMatch = input.match(/(\d+\s?(?:kg|g|l|litre|liter|packet|packets|bunch|bunches))/i);
  if (!quantityMatch) {
    return undefined;
  }
  return quantityMatch[1];
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function isOutRequest(input: string): boolean {
  return /(khatam|finish|finished|empty|out of|nahi hai|gone)/i.test(input);
}

function isLowRequest(input: string): boolean {
  return /(kam|low|less|thoda|running low)/i.test(input);
}

function guessStatus(input: string): 'out' | 'low' | 'in-stock' {
  if (isOutRequest(input)) {
    return 'out';
  }
  if (isLowRequest(input)) {
    return 'low';
  }
  return 'low';
}

function findMatchingUpdates(input: string, inventory: InventoryPromptItem[]) {
  const normalizedInput = normalize(input);
  const requestedQuantity = parseRequestedQuantity(input);
  return inventory
    .filter((item) => {
      const itemName = normalize(item.name);
      const itemNameHi = normalize(item.nameHi ?? '');
      const aliases = Object.entries(ITEM_ALIASES).find(([key]) => itemName.includes(key))?.[1] ?? [];
      return normalizedInput.includes(itemName)
        || (itemNameHi.length > 0 && normalizedInput.includes(itemNameHi))
        || aliases.some((alias) => normalizedInput.includes(alias));
    })
    .map((item) => ({
      itemId: item.id,
      newStatus: guessStatus(input),
      requestedQuantity,
    }));
}

function findUnlistedItems(input: string) {
  const normalizedInput = normalize(input);
  const requestedQuantity = parseRequestedQuantity(input);
  const unlistedItems: Array<{ name: string; status: 'out' | 'low' | 'in-stock'; category: string; requestedQuantity?: string }> = [];
  if (normalizedInput.includes('dhania')) {
    unlistedItems.push({
      name: 'Dhania',
      status: guessStatus(input),
      category: 'Veggies',
      requestedQuantity,
    });
  }
  return unlistedItems;
}

function parseBody(rawBody: unknown): ParseRequestBody {
  if (!rawBody || typeof rawBody !== 'object') {
    throw new Error('Invalid AI mock request body.');
  }

  const candidate = rawBody as Record<string, unknown>;
  if (typeof candidate.input !== 'string') {
    throw new Error('Invalid AI mock input.');
  }
  if (candidate.lang !== 'en' && candidate.lang !== 'hi') {
    throw new Error('Invalid AI mock language.');
  }
  if (!Array.isArray(candidate.inventory)) {
    throw new Error('Invalid AI mock inventory.');
  }

  const inventory = candidate.inventory.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid inventory item.');
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string') {
      throw new Error('Invalid inventory item shape.');
    }
    const nameHi = typeof row.nameHi === 'string' ? row.nameHi : undefined;
    return {
      id: row.id,
      name: row.name,
      nameHi,
    };
  });

  return {
    input: candidate.input,
    inventory,
    lang: candidate.lang,
  };
}

export function buildAiParseResponse(rawBody: unknown): unknown {
  const body = parseBody(rawBody);
  const normalizedInput = normalize(body.input);

  if (normalizedInput.includes('__e2e_malformed_ai__')) {
    return {
      understood: 'true',
      updates: [],
      unlistedItems: [],
    };
  }

  if (normalizedInput.includes('__e2e_unmatched_item__')) {
    const milkItem = body.inventory.find((item) => normalize(item.name).includes('milk')) ?? body.inventory[0];
    return {
      understood: true,
      updates: [
        {
          itemId: milkItem.id,
          newStatus: 'low',
        },
        {
          itemId: 'missing-inventory-item',
          newStatus: 'low',
        },
      ],
      unlistedItems: [],
    };
  }

  if (!body.input.trim()) {
    return {
      understood: false,
      message: 'Could not understand. Please try again.',
      updates: [],
      unlistedItems: [],
    };
  }

  const updates = findMatchingUpdates(body.input, body.inventory);
  const unlistedItems = findUnlistedItems(body.input);

  if (updates.length === 0 && unlistedItems.length === 0) {
    return {
      understood: false,
      message: 'Could not match any pantry items.',
      updates: [],
      unlistedItems: [],
    };
  }

  return {
    understood: true,
    updates,
    unlistedItems,
  };
}
