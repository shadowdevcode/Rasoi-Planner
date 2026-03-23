import { AiParseResult, InventoryStatus } from '../types';

const VALID_STATUSES: InventoryStatus[] = ['in-stock', 'low', 'out'];
const MAX_TEXT_LENGTH = 200;

function isInventoryStatus(value: unknown): value is InventoryStatus {
  return typeof value === 'string' && VALID_STATUSES.includes(value as InventoryStatus);
}

function isSafeOptionalText(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= MAX_TEXT_LENGTH);
}

export function validateAiParseResult(raw: unknown): AiParseResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI response was not an object.');
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.understood !== 'boolean') {
    throw new Error('AI response missing understood boolean.');
  }

  if (candidate.message !== undefined && typeof candidate.message !== 'string') {
    throw new Error('AI response has invalid message type.');
  }

  if (!Array.isArray(candidate.updates) || !Array.isArray(candidate.unlistedItems)) {
    throw new Error('AI response missing updates or unlistedItems arrays.');
  }

  const updates = candidate.updates.map((updateItem) => {
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
    if (!isSafeOptionalText(parsed.requestedQuantity)) {
      throw new Error('AI update requestedQuantity is invalid.');
    }
    return {
      itemId: parsed.itemId,
      newStatus: parsed.newStatus,
      requestedQuantity: parsed.requestedQuantity,
    };
  });

  const unlistedItems = candidate.unlistedItems.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('AI unlisted item is invalid.');
    }
    const parsed = item as Record<string, unknown>;
    if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0 || parsed.name.length > MAX_TEXT_LENGTH) {
      throw new Error('AI unlisted item name is invalid.');
    }
    if (!isInventoryStatus(parsed.status)) {
      throw new Error('AI unlisted item status is invalid.');
    }
    if (typeof parsed.category !== 'string' || parsed.category.trim().length === 0 || parsed.category.length > MAX_TEXT_LENGTH) {
      throw new Error('AI unlisted item category is invalid.');
    }
    if (!isSafeOptionalText(parsed.requestedQuantity)) {
      throw new Error('AI unlisted item requestedQuantity is invalid.');
    }
    return {
      name: parsed.name,
      status: parsed.status,
      category: parsed.category,
      requestedQuantity: parsed.requestedQuantity,
    };
  });

  return {
    understood: candidate.understood,
    message: candidate.message as string | undefined,
    updates,
    unlistedItems,
  };
}
