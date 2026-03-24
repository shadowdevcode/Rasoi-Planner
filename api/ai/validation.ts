export type Language = 'en' | 'hi';
export type InventoryStatus = 'in-stock' | 'low' | 'out';

export type InventoryPromptItem = {
  id: string;
  name: string;
  nameHi?: string;
};

export type AiParseResult = {
  understood: boolean;
  message?: string;
  updates: {
    itemId: string;
    newStatus: InventoryStatus;
    requestedQuantity?: string;
  }[];
  unlistedItems: {
    name: string;
    status: InventoryStatus;
    category: string;
    requestedQuantity?: string;
  }[];
};

const VALID_STATUSES: InventoryStatus[] = ['in-stock', 'low', 'out'];
const MAX_TEXT_LENGTH = 200;

function isInventoryStatus(value: unknown): value is InventoryStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as InventoryStatus);
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value.length <= MAX_TEXT_LENGTH ? value : value.slice(0, MAX_TEXT_LENGTH);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value);
    return normalized.length <= MAX_TEXT_LENGTH ? normalized : normalized.slice(0, MAX_TEXT_LENGTH);
  }

  return undefined;
}

function normalizeOptionalMessage(value: unknown): string | undefined {
  return normalizeOptionalText(value);
}

function normalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function validateAiParseResult(raw: unknown): AiParseResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI response was not an object.');
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.understood !== 'boolean') {
    throw new Error('AI response missing understood boolean.');
  }

  const message = normalizeOptionalMessage(candidate.message);
  const rawUpdates = normalizeArray(candidate.updates);
  const rawUnlistedItems = normalizeArray(candidate.unlistedItems);

  const updates = rawUpdates.map((updateItem) => {
    if (!updateItem || typeof updateItem !== 'object') {
      throw new Error('AI update item is invalid.');
    }

    const parsed = updateItem as Record<string, unknown>;
    if (typeof parsed.itemId !== 'string' || parsed.itemId.trim().length === 0) {
      throw new Error('AI update itemId is invalid.');
    }

    if (!isInventoryStatus(parsed.newStatus)) {
      throw new Error('AI update status is invalid.');
    }

    const requestedQuantity = normalizeOptionalText(parsed.requestedQuantity);

    return {
      itemId: parsed.itemId,
      newStatus: parsed.newStatus,
      requestedQuantity,
    };
  });

  const unlistedItems = rawUnlistedItems.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('AI unlisted item is invalid.');
    }

    const parsed = item as Record<string, unknown>;
    if (
      typeof parsed.name !== 'string' ||
      parsed.name.trim().length === 0 ||
      parsed.name.length > MAX_TEXT_LENGTH
    ) {
      throw new Error('AI unlisted item name is invalid.');
    }

    if (!isInventoryStatus(parsed.status)) {
      throw new Error('AI unlisted item status is invalid.');
    }

    if (
      typeof parsed.category !== 'string' ||
      parsed.category.trim().length === 0 ||
      parsed.category.length > MAX_TEXT_LENGTH
    ) {
      throw new Error('AI unlisted item category is invalid.');
    }

    const requestedQuantity = normalizeOptionalText(parsed.requestedQuantity);

    return {
      name: parsed.name,
      status: parsed.status,
      category: parsed.category,
      requestedQuantity,
    };
  });

  return {
    understood: candidate.understood,
    message,
    updates,
    unlistedItems,
  };
}
