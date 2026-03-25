import { InventoryItem } from '../types';
import { PantryCategoryKey, normalizePantryCategory } from './pantryCategory';

export type IngredientVisualSource = 'catalog-match' | 'existing-icon' | 'category-fallback';

export interface IngredientCatalogMetadata {
  key: IngredientVisualKey;
  canonicalName: string;
  transliteration: string;
  nativeName: string;
  matchedKeyword: string;
}

export interface IngredientVisual {
  imageUrl: string | null;
  fallbackIcon: string;
  altText: string;
  source: IngredientVisualSource;
  catalogMatch?: IngredientCatalogMetadata;
}

export interface IngredientVisualInput {
  name: string;
  nameHi?: string;
  category: string;
  icon?: string;
}

interface IngredientCatalogEntry<TKey extends string = string> {
  key: TKey;
  fallbackIcon: string;
  altText: string;
  imageObjectKey: string;
  canonicalName: string;
  transliteration: string;
  nativeName: string;
  keywords: readonly string[];
}

interface IngredientCatalogEntryDefinition<TKey extends string> {
  key: TKey;
  fallbackIcon: string;
  canonicalName: string;
  transliteration: string;
  nativeName: string;
  imageObjectKey: string;
  keywords: readonly string[];
}

interface IngredientCatalogMatch {
  entry: IngredientCatalogEntry;
  normalizedKeyword: string;
  score: number;
  entryIndex: number;
}

const CATEGORY_FALLBACK_ICONS: Record<PantryCategoryKey, string> = {
  spices: '🫙',
  pulses: '🥣',
  staples: '🌾',
  veggies: '🥕',
  dairy: '🥛',
  other: '📦',
};

function buildCatalogImageUrl(baseUrl: string, objectKey: string): string {
  return `${baseUrl}/${encodeURIComponent(objectKey)}`;
}

function normalizeCatalogImageBaseUrl(rawBaseUrl: string): string {
  const trimmedValue = rawBaseUrl.trim();
  if (trimmedValue.length === 0) {
    throw new Error('VITE_INGREDIENT_IMAGE_BASE_URL is configured but empty.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue);
  } catch (error) {
    throw new Error(`VITE_INGREDIENT_IMAGE_BASE_URL is invalid: ${trimmedValue}`, {
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error(`VITE_INGREDIENT_IMAGE_BASE_URL must use http or https: ${trimmedValue}`);
  }

  return trimmedValue.replace(/\/+$/u, '');
}

function getCatalogImageBaseUrlFromEnv(): string | undefined {
  const viteEnvCandidate = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const processEnvCandidate = typeof process !== 'undefined' ? process.env : undefined;
  return viteEnvCandidate?.VITE_INGREDIENT_IMAGE_BASE_URL ?? processEnvCandidate?.VITE_INGREDIENT_IMAGE_BASE_URL;
}

let cachedCatalogImageBaseUrlConfig: string | undefined;
let cachedCatalogImageBaseUrlValue: string | null | undefined;

function getCatalogImageBaseUrl(): string | null {
  const configuredBaseUrl = getCatalogImageBaseUrlFromEnv();
  if (cachedCatalogImageBaseUrlValue !== undefined && cachedCatalogImageBaseUrlConfig === configuredBaseUrl) {
    return cachedCatalogImageBaseUrlValue;
  }

  if (configuredBaseUrl === undefined) {
    cachedCatalogImageBaseUrlConfig = configuredBaseUrl;
    cachedCatalogImageBaseUrlValue = null;
    return cachedCatalogImageBaseUrlValue;
  }

  try {
    cachedCatalogImageBaseUrlConfig = configuredBaseUrl;
    cachedCatalogImageBaseUrlValue = normalizeCatalogImageBaseUrl(configuredBaseUrl);
    return cachedCatalogImageBaseUrlValue;
  } catch (error) {
    console.warn(
      'Ingredient catalog images are disabled because VITE_INGREDIENT_IMAGE_BASE_URL is invalid.',
      {
        configuredBaseUrl,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    cachedCatalogImageBaseUrlConfig = configuredBaseUrl;
    cachedCatalogImageBaseUrlValue = null;
    return cachedCatalogImageBaseUrlValue;
  }
}

function createIngredientCatalogEntry<TKey extends string>(
  definition: IngredientCatalogEntryDefinition<TKey>,
): IngredientCatalogEntry<TKey> {
  return {
    key: definition.key,
    fallbackIcon: definition.fallbackIcon,
    altText: `Photo of ${definition.canonicalName.toLowerCase()} (${definition.transliteration})`,
    imageObjectKey: definition.imageObjectKey,
    canonicalName: definition.canonicalName,
    transliteration: definition.transliteration,
    nativeName: definition.nativeName,
    keywords: [
      definition.canonicalName,
      definition.transliteration,
      definition.nativeName,
      ...definition.keywords,
    ],
  };
}

const INGREDIENT_CATALOG = [
  createIngredientCatalogEntry({
    key: 'turmeric',
    fallbackIcon: '🟡',
    canonicalName: 'Turmeric',
    transliteration: 'Haldi',
    nativeName: 'हल्दी',
    imageObjectKey: 'turmeric.webp',
    keywords: ['turmeric powder'],
  }),
  createIngredientCatalogEntry({
    key: 'red-chilli',
    fallbackIcon: '🌶️',
    canonicalName: 'Red Chilli Powder',
    transliteration: 'Lal Mirch',
    nativeName: 'लाल मिर्च',
    imageObjectKey: 'red-chilli.webp',
    keywords: ['red chili powder', 'red chilli', 'red chili', 'kashmiri mirch', 'lal mirch powder'],
  }),
  createIngredientCatalogEntry({
    key: 'coriander-powder',
    fallbackIcon: '🟤',
    canonicalName: 'Coriander Powder',
    transliteration: 'Dhania Powder',
    nativeName: 'धनिया पाउडर',
    imageObjectKey: 'coriander-powder.webp',
    keywords: ['coriander', 'dhania', 'ground coriander'],
  }),
  createIngredientCatalogEntry({
    key: 'garam-masala',
    fallbackIcon: '🧆',
    canonicalName: 'Garam Masala',
    transliteration: 'Garam Masala',
    nativeName: 'गरम मसाला',
    imageObjectKey: 'garam-masala.webp',
    keywords: ['punjabi garam masala'],
  }),
  createIngredientCatalogEntry({
    key: 'cumin',
    fallbackIcon: '🟤',
    canonicalName: 'Cumin Seeds',
    transliteration: 'Jeera',
    nativeName: 'जीरा',
    imageObjectKey: 'cumin.webp',
    keywords: ['cumin', 'cumin seed', 'cumin seeds', 'jeera seeds'],
  }),
  createIngredientCatalogEntry({
    key: 'mustard-seeds',
    fallbackIcon: '⚫',
    canonicalName: 'Mustard Seeds',
    transliteration: 'Rai',
    nativeName: 'राई',
    imageObjectKey: 'mustard-seeds.webp',
    keywords: ['mustard seed', 'sarson dana', 'rai dana'],
  }),
  createIngredientCatalogEntry({
    key: 'ajwain',
    fallbackIcon: '🟫',
    canonicalName: 'Carom Seeds',
    transliteration: 'Ajwain',
    nativeName: 'अजवाइन',
    imageObjectKey: 'ajwain.webp',
    keywords: ['ajowan', 'carom seed', 'carom seeds'],
  }),
  createIngredientCatalogEntry({
    key: 'hing',
    fallbackIcon: '🧂',
    canonicalName: 'Asafoetida',
    transliteration: 'Hing',
    nativeName: 'हींग',
    imageObjectKey: 'hing.webp',
    keywords: ['asafoetida powder'],
  }),
  createIngredientCatalogEntry({
    key: 'kasuri-methi',
    fallbackIcon: '🌿',
    canonicalName: 'Dried Fenugreek Leaves',
    transliteration: 'Kasuri Methi',
    nativeName: 'कसूरी मेथी',
    imageObjectKey: 'kasuri-methi.webp',
    keywords: ['fenugreek leaves', 'dried fenugreek', 'methi leaves'],
  }),
  createIngredientCatalogEntry({
    key: 'black-pepper',
    fallbackIcon: '⚫',
    canonicalName: 'Black Pepper',
    transliteration: 'Kali Mirch',
    nativeName: 'काली मिर्च',
    imageObjectKey: 'black-pepper.webp',
    keywords: ['peppercorn', 'peppercorns'],
  }),
  createIngredientCatalogEntry({
    key: 'cinnamon',
    fallbackIcon: '🪵',
    canonicalName: 'Cinnamon',
    transliteration: 'Dalchini',
    nativeName: 'दालचीनी',
    imageObjectKey: 'cinnamon.webp',
    keywords: ['cinnamon stick', 'cinnamon sticks'],
  }),
  createIngredientCatalogEntry({
    key: 'cardamom',
    fallbackIcon: '🫛',
    canonicalName: 'Green Cardamom',
    transliteration: 'Elaichi',
    nativeName: 'इलायची',
    imageObjectKey: 'cardamom.webp',
    keywords: ['cardamom', 'cardamom pods', 'green elaichi', 'elaichi dana'],
  }),
  createIngredientCatalogEntry({
    key: 'clove',
    fallbackIcon: '📍',
    canonicalName: 'Cloves',
    transliteration: 'Laung',
    nativeName: 'लौंग',
    imageObjectKey: 'clove.webp',
    keywords: ['clove', 'whole cloves'],
  }),
  createIngredientCatalogEntry({
    key: 'bay-leaf',
    fallbackIcon: '🍃',
    canonicalName: 'Bay Leaf',
    transliteration: 'Tej Patta',
    nativeName: 'तेज पत्ता',
    imageObjectKey: 'bay-leaf.webp',
    keywords: ['bay leaves', 'tej patta'],
  }),
  createIngredientCatalogEntry({
    key: 'mustard-oil',
    fallbackIcon: '🛢️',
    canonicalName: 'Mustard Oil',
    transliteration: 'Sarson Ka Tel',
    nativeName: 'सरसों का तेल',
    imageObjectKey: 'mustard-oil.webp',
    keywords: ['sarson oil', 'sarso oil'],
  }),
  createIngredientCatalogEntry({
    key: 'sunflower-oil',
    fallbackIcon: '🛢️',
    canonicalName: 'Sunflower Oil',
    transliteration: 'Sunflower Tel',
    nativeName: 'सनफ्लावर तेल',
    imageObjectKey: 'sunflower-oil.webp',
    keywords: ['refined oil', 'refined tel', 'cooking oil'],
  }),
  createIngredientCatalogEntry({
    key: 'ghee',
    fallbackIcon: '🫙',
    canonicalName: 'Ghee',
    transliteration: 'Ghee',
    nativeName: 'घी',
    imageObjectKey: 'ghee.webp',
    keywords: ['desi ghee', 'clarified butter'],
  }),
  createIngredientCatalogEntry({
    key: 'onion',
    fallbackIcon: '🧅',
    canonicalName: 'Onion',
    transliteration: 'Pyaz',
    nativeName: 'प्याज',
    imageObjectKey: 'onion.webp',
    keywords: ['onions', 'pyaaz'],
  }),
  createIngredientCatalogEntry({
    key: 'tomato',
    fallbackIcon: '🍅',
    canonicalName: 'Tomato',
    transliteration: 'Tamatar',
    nativeName: 'टमाटर',
    imageObjectKey: 'tomato.webp',
    keywords: ['tomatoes'],
  }),
  createIngredientCatalogEntry({
    key: 'potato',
    fallbackIcon: '🥔',
    canonicalName: 'Potato',
    transliteration: 'Aloo',
    nativeName: 'आलू',
    imageObjectKey: 'potato.webp',
    keywords: ['potatoes'],
  }),
  createIngredientCatalogEntry({
    key: 'ginger',
    fallbackIcon: '🫚',
    canonicalName: 'Ginger',
    transliteration: 'Adrak',
    nativeName: 'अदरक',
    imageObjectKey: 'ginger.webp',
    keywords: ['fresh ginger'],
  }),
  createIngredientCatalogEntry({
    key: 'garlic',
    fallbackIcon: '🧄',
    canonicalName: 'Garlic',
    transliteration: 'Lehsun',
    nativeName: 'लहसुन',
    imageObjectKey: 'garlic.webp',
    keywords: ['lahsun', 'garlic cloves'],
  }),
  createIngredientCatalogEntry({
    key: 'green-chilli',
    fallbackIcon: '🌶️',
    canonicalName: 'Green Chilli',
    transliteration: 'Hari Mirch',
    nativeName: 'हरी मिर्च',
    imageObjectKey: 'green-chilli.webp',
    keywords: ['green chili', 'green chillies', 'green chiles', 'hari mirch'],
  }),
  createIngredientCatalogEntry({
    key: 'coriander-leaves',
    fallbackIcon: '🌿',
    canonicalName: 'Coriander Leaves',
    transliteration: 'Hara Dhania',
    nativeName: 'हरा धनिया',
    imageObjectKey: 'coriander-leaves.webp',
    keywords: ['coriander leaf', 'coriander leaves', 'cilantro', 'dhania patta', 'hara dhaniya'],
  }),
  createIngredientCatalogEntry({
    key: 'mint',
    fallbackIcon: '🌿',
    canonicalName: 'Mint Leaves',
    transliteration: 'Pudina',
    nativeName: 'पुदीना',
    imageObjectKey: 'mint.webp',
    keywords: ['mint', 'mint leaf', 'mint leaves'],
  }),
  createIngredientCatalogEntry({
    key: 'lemon',
    fallbackIcon: '🍋',
    canonicalName: 'Lemon',
    transliteration: 'Nimbu',
    nativeName: 'नींबू',
    imageObjectKey: 'lemon.webp',
    keywords: ['lemons', 'nimbu'],
  }),
  createIngredientCatalogEntry({
    key: 'rice',
    fallbackIcon: '🍚',
    canonicalName: 'Basmati Rice',
    transliteration: 'Chawal',
    nativeName: 'चावल',
    imageObjectKey: 'rice.webp',
    keywords: ['rice', 'rice grains', 'basmati', 'basmati chawal'],
  }),
  createIngredientCatalogEntry({
    key: 'atta',
    fallbackIcon: '🌾',
    canonicalName: 'Whole Wheat Flour',
    transliteration: 'Atta',
    nativeName: 'आटा',
    imageObjectKey: 'atta.webp',
    keywords: ['atta flour', 'wheat flour', 'whole wheat atta', 'gehun ka atta', 'गेहूं का आटा'],
  }),
  createIngredientCatalogEntry({
    key: 'besan',
    fallbackIcon: '🟨',
    canonicalName: 'Gram Flour',
    transliteration: 'Besan',
    nativeName: 'बेसन',
    imageObjectKey: 'besan.webp',
    keywords: ['chickpea flour', 'gram flour', 'besan flour'],
  }),
  createIngredientCatalogEntry({
    key: 'suji',
    fallbackIcon: '🥣',
    canonicalName: 'Semolina',
    transliteration: 'Suji',
    nativeName: 'सूजी',
    imageObjectKey: 'suji.webp',
    keywords: ['sooji', 'rava', 'rawa', 'semolina', 'upma rava'],
  }),
  createIngredientCatalogEntry({
    key: 'maida',
    fallbackIcon: '⚪',
    canonicalName: 'Refined Flour',
    transliteration: 'Maida',
    nativeName: 'मैदा',
    imageObjectKey: 'maida.webp',
    keywords: ['all purpose flour', 'all-purpose flour', 'plain flour'],
  }),
  createIngredientCatalogEntry({
    key: 'poha',
    fallbackIcon: '🍚',
    canonicalName: 'Flattened Rice',
    transliteration: 'Poha',
    nativeName: 'पोहा',
    imageObjectKey: 'poha.webp',
    keywords: ['beaten rice', 'flattened rice', 'poha rice'],
  }),
  createIngredientCatalogEntry({
    key: 'toor-dal',
    fallbackIcon: '🥣',
    canonicalName: 'Toor Dal',
    transliteration: 'Arhar Dal',
    nativeName: 'तूर दाल',
    imageObjectKey: 'toor-dal.webp',
    keywords: ['tur dal', 'tuar dal', 'arhar', 'arhar dal', 'pigeon pea', 'pigeon peas'],
  }),
  createIngredientCatalogEntry({
    key: 'moong-dal',
    fallbackIcon: '🥣',
    canonicalName: 'Moong Dal',
    transliteration: 'Moong Dal',
    nativeName: 'मूंग दाल',
    imageObjectKey: 'moong-dal.webp',
    keywords: ['mung dal', 'moong', 'yellow moong dal', 'split moong dal'],
  }),
  createIngredientCatalogEntry({
    key: 'masoor-dal',
    fallbackIcon: '🥣',
    canonicalName: 'Masoor Dal',
    transliteration: 'Masoor Dal',
    nativeName: 'मसूर दाल',
    imageObjectKey: 'masoor-dal.webp',
    keywords: ['red lentil', 'red lentils', 'masoor'],
  }),
  createIngredientCatalogEntry({
    key: 'chana-dal',
    fallbackIcon: '🥣',
    canonicalName: 'Chana Dal',
    transliteration: 'Chana Dal',
    nativeName: 'चना दाल',
    imageObjectKey: 'chana-dal.webp',
    keywords: ['split chickpea', 'split chickpeas', 'split bengal gram', 'bengal gram'],
  }),
  createIngredientCatalogEntry({
    key: 'urad-dal',
    fallbackIcon: '🥣',
    canonicalName: 'Urad Dal',
    transliteration: 'Urad Dal',
    nativeName: 'उड़द दाल',
    imageObjectKey: 'urad-dal.webp',
    keywords: ['udad dal', 'urad', 'black gram'],
  }),
  createIngredientCatalogEntry({
    key: 'rajma',
    fallbackIcon: '🫘',
    canonicalName: 'Kidney Beans',
    transliteration: 'Rajma',
    nativeName: 'राजमा',
    imageObjectKey: 'rajma.webp',
    keywords: ['rajma beans', 'kidney bean', 'kidney beans'],
  }),
  createIngredientCatalogEntry({
    key: 'chole',
    fallbackIcon: '🫘',
    canonicalName: 'Chickpeas',
    transliteration: 'Chole',
    nativeName: 'छोले',
    imageObjectKey: 'chole.webp',
    keywords: ['kabuli chana', 'chana', 'white chana', 'white chickpeas', 'chickpea', 'chickpeas'],
  }),
  createIngredientCatalogEntry({
    key: 'milk',
    fallbackIcon: '🥛',
    canonicalName: 'Milk',
    transliteration: 'Doodh',
    nativeName: 'दूध',
    imageObjectKey: 'milk.webp',
    keywords: ['full cream milk'],
  }),
  createIngredientCatalogEntry({
    key: 'curd',
    fallbackIcon: '🥣',
    canonicalName: 'Curd',
    transliteration: 'Dahi',
    nativeName: 'दही',
    imageObjectKey: 'curd.webp',
    keywords: ['yogurt', 'yoghurt', 'plain curd'],
  }),
  createIngredientCatalogEntry({
    key: 'paneer',
    fallbackIcon: '🧈',
    canonicalName: 'Paneer',
    transliteration: 'Paneer',
    nativeName: 'पनीर',
    imageObjectKey: 'paneer.webp',
    keywords: ['cottage cheese', 'paneer cubes'],
  }),
  createIngredientCatalogEntry({
    key: 'salt',
    fallbackIcon: '🧂',
    canonicalName: 'Salt',
    transliteration: 'Namak',
    nativeName: 'नमक',
    imageObjectKey: 'salt.webp',
    keywords: ['table salt', 'iodized salt'],
  }),
  createIngredientCatalogEntry({
    key: 'black-salt',
    fallbackIcon: '🧂',
    canonicalName: 'Black Salt',
    transliteration: 'Kala Namak',
    nativeName: 'काला नमक',
    imageObjectKey: 'black-salt.webp',
    keywords: ['kala namak', 'black salt powder'],
  }),
  createIngredientCatalogEntry({
    key: 'sugar',
    fallbackIcon: '🍚',
    canonicalName: 'Sugar',
    transliteration: 'Cheeni',
    nativeName: 'चीनी',
    imageObjectKey: 'sugar.webp',
    keywords: ['granulated sugar'],
  }),
] as const;

function assertIngredientCatalogImageCoverage(catalog: readonly IngredientCatalogEntry[]): void {
  const seenImageObjectKeys = new Set<string>();
  for (const entry of catalog) {
    const normalizedImageObjectKey = entry.imageObjectKey.trim();
    if (normalizedImageObjectKey.length === 0) {
      throw new Error(`Ingredient catalog entry "${entry.key}" is missing imageObjectKey.`);
    }

    if (seenImageObjectKeys.has(normalizedImageObjectKey)) {
      throw new Error(`Ingredient catalog imageObjectKey is duplicated: ${normalizedImageObjectKey}`);
    }

    seenImageObjectKeys.add(normalizedImageObjectKey);
  }
}

assertIngredientCatalogImageCoverage(INGREDIENT_CATALOG);

export type IngredientVisualKey = (typeof INGREDIENT_CATALOG)[number]['key'];

function normalizeIngredientText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildIngredientSearchText(input: IngredientVisualInput): string {
  return normalizeIngredientText([input.name, input.nameHi].filter(Boolean).join(' '));
}

function matchesKeyword(searchText: string, keyword: string): boolean {
  const paddedSearchText = ` ${searchText} `;
  const paddedKeyword = ` ${keyword} `;
  return paddedSearchText.includes(paddedKeyword);
}

function compareIngredientCatalogMatches(candidate: IngredientCatalogMatch, currentBest: IngredientCatalogMatch): number {
  if (candidate.score !== currentBest.score) {
    return candidate.score - currentBest.score;
  }

  if (candidate.entryIndex !== currentBest.entryIndex) {
    return currentBest.entryIndex - candidate.entryIndex;
  }

  return currentBest.normalizedKeyword.localeCompare(candidate.normalizedKeyword);
}

function findIngredientCatalogMatch(searchText: string): IngredientCatalogMatch | null {
  let bestMatch: IngredientCatalogMatch | null = null;

  for (const [entryIndex, entry] of INGREDIENT_CATALOG.entries()) {
    for (const keywordValue of entry.keywords) {
      const normalizedKeyword = normalizeIngredientText(keywordValue);
      if (normalizedKeyword.length === 0 || !matchesKeyword(searchText, normalizedKeyword)) {
        continue;
      }

      const candidate: IngredientCatalogMatch = {
        entry,
        normalizedKeyword,
        score: (searchText === normalizedKeyword ? 1000 : 0) + normalizedKeyword.length,
        entryIndex,
      };

      if (bestMatch === null || compareIngredientCatalogMatches(candidate, bestMatch) > 0) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

function hasRenderableIcon(icon: string | undefined): icon is string {
  return typeof icon === 'string' && icon.trim().length > 0;
}

function getFallbackAltText(input: IngredientVisualInput): string {
  return `Ingredient icon for ${input.name}`;
}

function createIngredientCatalogMetadata(match: IngredientCatalogMatch): IngredientCatalogMetadata {
  return {
    key: match.entry.key as IngredientVisualKey,
    canonicalName: match.entry.canonicalName,
    transliteration: match.entry.transliteration,
    nativeName: match.entry.nativeName,
    matchedKeyword: match.normalizedKeyword,
  };
}

export function getIngredientNativeContextLabel(input: Pick<IngredientVisualInput, 'nameHi'>, visual: IngredientVisual): string | null {
  const trimmedNameHi = typeof input.nameHi === 'string' ? input.nameHi.trim() : '';
  if (visual.catalogMatch !== undefined) {
    const resolvedNativeName = trimmedNameHi.length > 0 ? trimmedNameHi : visual.catalogMatch.nativeName;
    return `${visual.catalogMatch.transliteration} / ${resolvedNativeName}`;
  }

  return trimmedNameHi.length > 0 ? trimmedNameHi : null;
}

export function resolveIngredientVisual(input: IngredientVisualInput): IngredientVisual {
  const searchText = buildIngredientSearchText(input);
  const catalogMatch = findIngredientCatalogMatch(searchText);
  if (catalogMatch !== null) {
    const imageBaseUrl = getCatalogImageBaseUrl();
    const imageUrl = imageBaseUrl === null ? null : buildCatalogImageUrl(imageBaseUrl, catalogMatch.entry.imageObjectKey);
    return {
      imageUrl,
      fallbackIcon: catalogMatch.entry.fallbackIcon,
      altText: catalogMatch.entry.altText,
      source: 'catalog-match',
      catalogMatch: createIngredientCatalogMetadata(catalogMatch),
    };
  }

  if (hasRenderableIcon(input.icon)) {
    return {
      imageUrl: null,
      fallbackIcon: input.icon.trim(),
      altText: getFallbackAltText(input),
      source: 'existing-icon',
    };
  }

  const category = normalizePantryCategory(input.category);
  return {
    imageUrl: null,
    fallbackIcon: CATEGORY_FALLBACK_ICONS[category],
    altText: getFallbackAltText(input),
    source: 'category-fallback',
  };
}

export function resolveInventoryItemVisual(item: InventoryItem): IngredientVisual {
  return resolveIngredientVisual({
    name: item.name,
    nameHi: item.nameHi,
    category: item.category,
    icon: item.icon,
  });
}
