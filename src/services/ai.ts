import { GoogleGenAI, Type } from '@google/genai';
import { InventoryItem, InventoryStatus, AiParseResult } from '../types';

// Initialize the Gemini API client
// We use lazy initialization to avoid crashing if the key is missing on load
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY is missing. AI features will not work.');
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export async function parseCookVoiceInput(
  input: string,
  inventory: InventoryItem[],
  lang: 'en' | 'hi'
): Promise<AiParseResult> {
  const ai = getAiClient();
  if (!ai) return { understood: false, message: 'AI not configured', updates: [], unlistedItems: [] };

  try {
    const inventoryContext = inventory
      .map((i) => `{ id: "${i.id}", name: "${i.name}", nameHi: "${i.nameHi || ''}" }`)
      .join(', ');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are an AI assistant for an Indian kitchen. The cook says: "${input}".
      Language preference for replies: ${lang === 'hi' ? 'Hindi/Hinglish' : 'English'}.
      
      Task 1: Intent Classification. Is this gibberish, chit-chat, or missing an item name? If yes, set 'understood' to false and provide a helpful 'message' asking for clarification.
      Task 2: Match their request to the following inventory items: [${inventoryContext}]. Determine the new status ('in-stock', 'low', 'out'). If they specify a quantity (e.g., "2 kilo", "500g", "3 packets"), extract it as 'requestedQuantity'.
      Task 3: If they mention an item NOT in the inventory, add it to 'unlistedItems' with a guessed status, a guessed 'category' (e.g., Vegetables, Spices, Dairy, Grains, Meat, Snacks, Cleaning), and any 'requestedQuantity'.
      
      Return a JSON object matching this schema.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
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
              }
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
              }
            }
          },
          required: ['understood', 'updates', 'unlistedItems'],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return { understood: false, message: 'Empty response', updates: [], unlistedItems: [] };
  } catch (error) {
    console.error('AI parse error:', error);
    return { understood: false, message: 'Error parsing request', updates: [], unlistedItems: [] };
  }
}
