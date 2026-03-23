import { AiParseResult, InventoryItem, Language } from '../types';
import { validateAiParseResult } from './aiValidation';

type ParseCookVoiceInputRequest = {
  input: string;
  inventory: InventoryItem[];
  lang: Language;
};

type ParseCookVoiceInputErrorResponse = {
  message?: string;
};

const AI_PARSE_ENDPOINT = '/api/ai/parse';
const DEFAULT_AI_ERROR_MESSAGE = 'Could not process AI response safely. Please retry with clearer input.';

function createAiFailureResult(message: string): AiParseResult {
  return {
    understood: false,
    message,
    updates: [],
    unlistedItems: [],
  };
}

async function parseErrorResponse(response: Response): Promise<ParseCookVoiceInputErrorResponse | null> {
  try {
    const parsed = (await response.json()) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (candidate.message !== undefined && typeof candidate.message !== 'string') {
      return null;
    }

    const message = candidate.message as string | undefined;

    return {
      message,
    };
  } catch (error) {
    console.warn('ai_parse_error_response_invalid', {
      endpoint: AI_PARSE_ENDPOINT,
      status: response.status,
      error,
    });
    return null;
  }
}

function createRequestBody(input: string, inventory: InventoryItem[], lang: Language): ParseCookVoiceInputRequest {
  return {
    input,
    inventory,
    lang,
  };
}

export async function parseCookVoiceInput(
  input: string,
  inventory: InventoryItem[],
  lang: Language
): Promise<AiParseResult> {
  try {
    const response = await fetch(AI_PARSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createRequestBody(input, inventory, lang)),
    });

    if (!response.ok) {
      const errorResponse = await parseErrorResponse(response);
      return createAiFailureResult(errorResponse?.message ?? DEFAULT_AI_ERROR_MESSAGE);
    }

    const parsed = (await response.json()) as unknown;
    return validateAiParseResult(parsed);
  } catch (error) {
    console.error('AI parse request failed:', error);
    return createAiFailureResult(DEFAULT_AI_ERROR_MESSAGE);
  }
}
