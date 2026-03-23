interface GenerateContentInput {
  contents: string;
}

interface InventoryContextItem {
  id: string;
  name: string;
  nameHi: string;
}

const ITEM_ALIASES: Record<string, string[]> = {
  tomatoes: ['tamatar', 'tomato', 'tomatoes'],
};

function extractCookInput(contents: string): string {
  const match = contents.match(/The cook says: "([\s\S]*?)"\./);
  return match?.[1] ?? '';
}

function extractInventory(contents: string): InventoryContextItem[] {
  return [...contents.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", nameHi: "([^"]*)" \}/g)].map((match) => ({
    id: match[1],
    name: match[2],
    nameHi: match[3],
  }));
}

function parseRequestedQuantity(input: string): string | undefined {
  const match = input.match(/(\d+\s?(?:kg|g|l|litre|liter|packet|packets|bunch|bunches))/i);
  return match?.[1];
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function isMalformedResponseRequest(input: string): boolean {
  return /__e2e_malformed_ai__/i.test(input);
}

function isUnmatchedItemRequest(input: string): boolean {
  return /__e2e_unmatched_item__/i.test(input);
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

function buildAiResponse(contents: string): string {
  const cookInput = extractCookInput(contents);
  const normalizedInput = normalize(cookInput);
  const inventory = extractInventory(contents);

  if (isMalformedResponseRequest(cookInput)) {
    return '{"understood":true,"updates":[';
  }

  if (isUnmatchedItemRequest(cookInput)) {
    const milkItem = inventory.find((item) => normalize(item.name).includes('milk')) ?? inventory[0];

    return JSON.stringify({
      understood: true,
      message: undefined,
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
    });
  }

  if (!cookInput.trim() || /^(hello|hi|test|asdf|qwerty)$/i.test(cookInput.trim())) {
    return JSON.stringify({
      understood: false,
      message: 'Please mention the ingredient and whether it is low or finished.',
      updates: [],
      unlistedItems: [],
    });
  }

  const requestedQuantity = parseRequestedQuantity(cookInput);
  const updates = inventory
    .filter((item) => {
      const itemName = normalize(item.name);
      const itemNameHi = normalize(item.nameHi);
      const condensedName = itemName.replace(/[^a-z]/g, '');
      const aliases = Object.entries(ITEM_ALIASES).find(([key]) => itemName.includes(key))?.[1] ?? [];
      return normalizedInput.includes(itemName)
        || (itemNameHi && normalizedInput.includes(itemNameHi))
        || normalizedInput.includes(condensedName)
        || aliases.some((alias) => normalizedInput.includes(alias));
    })
    .map((item) => ({
      itemId: item.id,
      newStatus: guessStatus(cookInput),
      requestedQuantity,
    }));

  const unlistedItems: { category: string; name: string; requestedQuantity?: string; status: 'out' | 'low' | 'in-stock' }[] = [];
  if (normalizedInput.includes('dhania')) {
    unlistedItems.push({
      name: 'Dhania',
      category: 'Veggies',
      requestedQuantity,
      status: guessStatus(cookInput),
    });
  }
  if (normalizedInput.includes('jeera') && !inventory.some((item) => normalize(item.name).includes('jeera'))) {
    unlistedItems.push({
      name: 'Jeera',
      category: 'Spices',
      requestedQuantity,
      status: guessStatus(cookInput),
    });
  }

  return JSON.stringify({
    understood: updates.length > 0 || unlistedItems.length > 0,
    message: updates.length > 0 || unlistedItems.length > 0 ? undefined : 'Could not match any pantry items.',
    updates,
    unlistedItems,
  });
}

export const Type = {
  ARRAY: 'array',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
  STRING: 'string',
} as const;

export class GoogleGenAI {
  constructor(_config: { apiKey: string }) {}

  models = {
    generateContent: async ({ contents }: GenerateContentInput): Promise<{ text: string }> => ({
      text: buildAiResponse(contents),
    }),
  };
}
