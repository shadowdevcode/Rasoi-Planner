import { UiLanguage } from '../types';

export type PantryCategoryKey = 'spices' | 'pulses' | 'staples' | 'veggies' | 'dairy' | 'other';
export interface PantryCategoryOption {
  value: PantryCategoryKey;
  label: string;
}

const CATEGORY_ALIASES: Record<PantryCategoryKey, readonly string[]> = {
  spices: ['spices', 'spice', 'masala', 'masale'],
  pulses: ['pulses', 'pulse', 'dal', 'dals', 'legumes'],
  staples: ['staples', 'staple', 'ration', 'main ration', 'grains', 'grain'],
  veggies: ['veggies', 'vegetables', 'vegetable', 'sabzi', 'sabziyan'],
  dairy: ['dairy', 'milk', 'curd', 'paneer'],
  other: ['other', 'others', 'misc', 'miscellaneous', 'requested'],
};

const OWNER_CATEGORY_LABELS: Record<PantryCategoryKey, string> = {
  spices: 'Spices (Masale / मसाले)',
  pulses: 'Pulses (Dal / दालें)',
  staples: 'Main Ration (Atta/Chawal/Tel / मुख्य राशन)',
  veggies: 'Vegetables (Sabzi / सब्ज़ियाँ)',
  dairy: 'Dairy (Doodh/Paneer / डेयरी)',
  other: 'Other (Baaki / अन्य)',
};

const CATEGORY_NAMES: Record<PantryCategoryKey, { en: string; hi: string }> = {
  spices: { en: 'Spices', hi: 'मसाले' },
  pulses: { en: 'Pulses', hi: 'दालें' },
  staples: { en: 'Main Ration', hi: 'मुख्य राशन' },
  veggies: { en: 'Vegetables', hi: 'सब्ज़ियाँ' },
  dairy: { en: 'Dairy', hi: 'डेयरी' },
  other: { en: 'Other', hi: 'अन्य' },
};

function sanitizeCategoryValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, ' ');
}

export function normalizePantryCategory(value: string): PantryCategoryKey {
  const sanitized = sanitizeCategoryValue(value);

  const match = (Object.entries(CATEGORY_ALIASES) as Array<[PantryCategoryKey, readonly string[]]>).find(([, aliases]) =>
    aliases.some((alias) => sanitized.includes(alias)),
  );

  if (!match) {
    return 'other';
  }

  return match[0];
}

export function getOwnerCategoryLabel(value: string): string {
  const key = normalizePantryCategory(value);
  return OWNER_CATEGORY_LABELS[key];
}

export function getPantryCategoryLabel(value: string): string {
  return getOwnerCategoryLabel(value);
}

export function getLocalizedCategoryName(value: string, language: UiLanguage): string {
  const key = normalizePantryCategory(value);
  return CATEGORY_NAMES[key][language];
}

export function getPantryCategoryOptions(): readonly PantryCategoryOption[] {
  return [
    { value: 'spices', label: OWNER_CATEGORY_LABELS.spices },
    { value: 'pulses', label: OWNER_CATEGORY_LABELS.pulses },
    { value: 'staples', label: OWNER_CATEGORY_LABELS.staples },
    { value: 'veggies', label: OWNER_CATEGORY_LABELS.veggies },
    { value: 'dairy', label: OWNER_CATEGORY_LABELS.dairy },
    { value: 'other', label: OWNER_CATEGORY_LABELS.other },
  ];
}

export function pantryCategoryMatchesSearch(category: string, rawSearchTerm: string): boolean {
  const searchTerm = rawSearchTerm.trim().toLowerCase();
  if (searchTerm.length === 0) {
    return true;
  }

  const key = normalizePantryCategory(category);
  const normalizedLabel = OWNER_CATEGORY_LABELS[key].toLowerCase();
  const normalizedEnglish = CATEGORY_NAMES[key].en.toLowerCase();
  const normalizedHindi = CATEGORY_NAMES[key].hi.toLowerCase();

  return normalizedLabel.includes(searchTerm) || normalizedEnglish.includes(searchTerm) || normalizedHindi.includes(searchTerm);
}
