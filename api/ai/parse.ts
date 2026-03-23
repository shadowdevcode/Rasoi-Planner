import { GoogleGenAI, Type } from '@google/genai';
import { validateAiParseResult } from '../../src/services/aiValidation';
import { AiParseResult, InventoryItem, Language } from '../../src/types';

type ParseCookVoiceInputRequest = {
  input: string;
  inventory: InventoryPromptItem[];
  lang: Language;
};

type InventoryPromptItem = Pick<InventoryItem, 'id' | 'name' | 'nameHi'>;

const AI_MODEL = 'gemini-3-flash-preview';
const AI_ENDPOINT_NAME = 'ai_parse';
const MAX_AI_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 250;
const EMPTY_AI_RESPONSE_MESSAGE = 'Empty response';

class AiParseRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AiParseRequestError';
  }
}

class AiParseConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AiParseConfigError';
  }
}

class AiParseExecutionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AiParseExecutionError';
  }
}

function createJsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function getEnvApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiParseConfigError('GEMINI_API_KEY is not configured for the AI parse endpoint.');
  }
  return apiKey;
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getEnvApiKey() });
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'hi';
}

function isInventoryPromptItem(value: unknown): value is InventoryPromptItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasValidId = typeof candidate.id === 'string' && candidate.id.trim().length > 0;
  const hasValidName = typeof candidate.name === 'string' && candidate.name.trim().length > 0;
  const hasValidHindiName = candidate.nameHi === undefined || typeof candidate.nameHi === 'string';

  return hasValidId && hasValidName && hasValidHindiName;
}

function parseRequestBody(raw: unknown): ParseCookVoiceInputRequest {
  if (!raw || typeof raw !== 'object') {
    throw new AiParseRequestError('AI parse request body must be an object.');
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.input !== 'string' || candidate.input.trim().length === 0) {
    throw new AiParseRequestError('AI parse request input must be a non-empty string.');
  }

  if (!Array.isArray(candidate.inventory) || !candidate.inventory.every(isInventoryPromptItem)) {
    throw new AiParseRequestError('AI parse request inventory must be an array of inventory items with id and name.');
  }

  if (!isLanguage(candidate.lang)) {
    throw new AiParseRequestError('AI parse request language must be "en" or "hi".');
  }

  return {
    input: candidate.input,
    inventory: candidate.inventory,
    lang: candidate.lang,
  };
}

function buildInventoryContext(inventory: InventoryPromptItem[]): string {
  return inventory
    .map((item) => `{ id: "${item.id}", name: "${item.name}", nameHi: "${item.nameHi ?? ''}" }`)
    .join(', ');
}

function buildPrompt(input: string, inventory: InventoryPromptItem[], lang: Language): string {
  const inventoryContext = buildInventoryContext(inventory);

  return `You are an AI assistant for an Indian kitchen. The cook says: "${input}".
      Language preference for replies: ${lang === 'hi' ? 'Hindi/Hinglish' : 'English'}.
      
      Task 1: Intent Classification. Is this gibberish, chit-chat, or missing an item name? If yes, set 'understood' to false and provide a helpful 'message' asking for clarification.
      Task 2: Match their request to the following inventory items: [${inventoryContext}]. Determine the new status ('in-stock', 'low', 'out'). If they specify a quantity (e.g., "2 kilo", "500g", "3 packets"), extract it as 'requestedQuantity'.
      Task 3: If they mention an item NOT in the inventory, add it to 'unlistedItems' with a guessed status, a guessed 'category' (e.g., Vegetables, Spices, Dairy, Grains, Meat, Snacks, Cleaning), and any 'requestedQuantity'.
      
      Return a JSON object matching this schema.`;
}

function createResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      understood: { type: Type.BOOLEAN },
      message: { type: Type.STRING },
      updates: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            itemId: { type: Type.STRING },
            newStatus: { type: Type.STRING },
            requestedQuantity: { type: Type.STRING },
          },
          required: ['itemId', 'newStatus'],
        },
      },
      unlistedItems: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            status: { type: Type.STRING },
            category: { type: Type.STRING },
            requestedQuantity: { type: Type.STRING },
          },
          required: ['name', 'status', 'category'],
        },
      },
    },
    required: ['understood', 'updates', 'unlistedItems'],
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function createAttemptWarning(attempt: number, input: string, inventoryCount: number, lang: Language, error: unknown): Record<string, unknown> {
  return {
    endpoint: AI_ENDPOINT_NAME,
    attempt,
    maxAttempts: MAX_AI_ATTEMPTS,
    inputLength: input.length,
    inventoryCount,
    lang,
    errorMessage: getErrorMessage(error),
  };
}

function getRetryDelayMs(attempt: number): number {
  return BASE_RETRY_DELAY_MS * attempt;
}

async function waitForRetry(delayMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function generateAiParseResult(input: string, inventory: InventoryPromptItem[], lang: Language): Promise<AiParseResult> {
  const aiClient = getAiClient();
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    try {
      const response = await aiClient.models.generateContent({
        model: AI_MODEL,
        contents: buildPrompt(input, inventory, lang),
        config: {
          responseMimeType: 'application/json',
          responseSchema: createResponseSchema(),
        },
      });

      if (!response.text) {
        throw new Error(EMPTY_AI_RESPONSE_MESSAGE);
      }

      const parsed = JSON.parse(response.text) as unknown;
      return validateAiParseResult(parsed);
    } catch (error) {
      lastError = error;
      console.warn('ai_parse_attempt_failed', createAttemptWarning(attempt, input, inventory.length, lang, error));

      if (attempt < MAX_AI_ATTEMPTS) {
        await waitForRetry(getRetryDelayMs(attempt));
      }
    }
  }

  throw new AiParseExecutionError(
    `AI parse failed after ${MAX_AI_ATTEMPTS} attempts. inputLength=${input.length} inventoryCount=${inventory.length} lang=${lang} error=${getErrorMessage(lastError)}`,
    {
      cause: lastError instanceof Error ? lastError : undefined,
    }
  );
}

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return createJsonResponse({ message: 'Method not allowed.' }, 405);
  }

  try {
    let body: unknown;

    try {
      body = (await request.json()) as unknown;
    } catch (error) {
      throw new AiParseRequestError('AI parse request body must be valid JSON.', {
        cause: error instanceof Error ? error : undefined,
      });
    }

    const { input, inventory, lang } = parseRequestBody(body);
    const result = await generateAiParseResult(input, inventory, lang);
    return createJsonResponse(result, 200);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const status =
      error instanceof AiParseRequestError ? 400 :
      error instanceof AiParseConfigError ? 503 :
      500;

    console.error('ai_parse_request_failed', {
      endpoint: AI_ENDPOINT_NAME,
      status,
      errorMessage,
    });

    return createJsonResponse({ message: status === 400 || status === 503 ? errorMessage : 'Could not process AI response safely. Please retry with clearer input.' }, status);
  }
}
