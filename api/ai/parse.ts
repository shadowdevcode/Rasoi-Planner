import { AiParseResult, InventoryPromptItem, Language, validateAiParseResult } from './validation.js';

type ParseCookVoiceInputRequest = {
  input: string;
  inventory: InventoryPromptItem[];
  lang: Language;
};

type NodeApiRequest = {
  method?: string;
  body?: unknown;
};

type NodeApiResponse = {
  status: (statusCode: number) => NodeApiResponse;
  json: (body: unknown) => void;
};

const AI_ENDPOINT_NAME = 'ai_parse';
const MAX_AI_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 250;
const AI_REQUEST_TIMEOUT_MS = 12000;
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
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

function sendJsonResponse(response: NodeApiResponse, body: unknown, status: number): void {
  response.status(status).json(body);
}

function getEnvApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiParseConfigError('GEMINI_API_KEY is not configured for the AI parse endpoint.');
  }
  return apiKey;
}

function getAiModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
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
  const parsedRaw = (() => {
    if (typeof raw !== 'string') {
      return raw;
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch (error) {
      throw new AiParseRequestError('AI parse request body must be valid JSON.', {
        cause: error instanceof Error ? error : undefined,
      });
    }
  })();

  if (!parsedRaw || typeof parsedRaw !== 'object') {
    throw new AiParseRequestError('AI parse request body must be an object.');
  }

  const candidate = parsedRaw as Record<string, unknown>;
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

function createTimeoutError(timeoutMs: number): Error {
  return new Error(`AI request timed out after ${timeoutMs}ms.`);
}

function buildGeminiEndpoint(model: string, apiKey: string): string {
  return `${GEMINI_API_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function createGeminiRequestBody(prompt: string): Record<string, unknown> {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
    },
  };
}

function parseGeminiText(raw: unknown): string {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Gemini response body is not an object.');
  }

  const parsed = raw as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(EMPTY_AI_RESPONSE_MESSAGE);
  }

  return text;
}

async function requestGeminiJson(prompt: string, apiKey: string, model: string, timeoutMs: number): Promise<unknown> {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(buildGeminiEndpoint(model, apiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createGeminiRequestBody(prompt)),
      signal: abortController.signal,
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `Gemini request failed. status=${response.status} body=${responseBody.slice(0, 1000)}`
      );
    }

    const parsed = JSON.parse(responseBody) as unknown;
    const text = parseGeminiText(parsed);
    return JSON.parse(text) as unknown;
  } catch (error) {
    const candidate = error as { name?: string };
    if (candidate?.name === 'AbortError') {
      throw createTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateAiParseResult(input: string, inventory: InventoryPromptItem[], lang: Language): Promise<AiParseResult> {
  const apiKey = getEnvApiKey();
  const aiModel = getAiModel();
  const prompt = buildPrompt(input, inventory, lang);
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    try {
      const parsed = await requestGeminiJson(prompt, apiKey, aiModel, AI_REQUEST_TIMEOUT_MS);
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

export default async function handler(request: NodeApiRequest, response: NodeApiResponse): Promise<void> {
  if (request.method !== 'POST') {
    sendJsonResponse(response, { message: 'Method not allowed.' }, 405);
    return;
  }

  try {
    const body = request.body;
    const { input, inventory, lang } = parseRequestBody(body);
    const result = await generateAiParseResult(input, inventory, lang);
    sendJsonResponse(response, result, 200);
    return;
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

    sendJsonResponse(
      response,
      { message: status === 400 || status === 503 ? errorMessage : 'Could not process AI response safely. Please retry with clearer input.' },
      status
    );
  }
}
