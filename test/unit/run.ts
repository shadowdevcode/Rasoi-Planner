import assert from 'node:assert/strict';
import { getAppCopy, getCookCopy, getOwnerCopy } from '../../src/i18n/copy';
import { validateAiParseResult } from '../../src/services/aiValidation';
import { buildPantryLog } from '../../src/services/logService';
import { sanitizeFirestorePayload } from '../../src/utils/firestorePayload';
import { getIngredientNativeContextLabel, resolveIngredientVisual } from '../../src/utils/ingredientVisuals';
import {
  getUnknownQueueLoadErrorMessage,
  isFirestoreFailedPreconditionError,
  isFirestorePermissionDeniedError,
  sortUnknownIngredientQueueItemsByCreatedAt,
  toFirestoreListenerErrorInfo,
} from '../../src/utils/unknownQueue';
import {
  getLocalizedCategoryName,
  getPantryCategoryLabel,
  getPantryCategoryOptions,
  normalizePantryCategory,
  pantryCategoryMatchesSearch,
} from '../../src/utils/pantryCategory';

process.env.VITE_INGREDIENT_IMAGE_BASE_URL = 'https://cdn.example.com/rasoi/ingredients';

function testPantryCategoryNormalization(): void {
  assert.equal(normalizePantryCategory('Spices'), 'spices');
  assert.equal(normalizePantryCategory('Staples'), 'staples');
  assert.equal(normalizePantryCategory('Veggies'), 'veggies');
  assert.equal(normalizePantryCategory('Dal Items'), 'pulses');
  assert.equal(normalizePantryCategory('unknown-category'), 'other');
}

function testPantryCategoryLabels(): void {
  const label = getPantryCategoryLabel('staples');
  assert.equal(label.includes('Main Ration'), true);
  assert.equal(label.includes('मुख्य राशन'), true);
  assert.equal(pantryCategoryMatchesSearch('staples', 'ration'), true);
  assert.equal(pantryCategoryMatchesSearch('staples', 'मुख्य'), true);
  assert.equal(pantryCategoryMatchesSearch('staples', 'dairy'), false);
}

function testPantryCategoryOptions(): void {
  const options = getPantryCategoryOptions();
  assert.equal(options.length, 6);
  assert.equal(options.some((option) => option.value === 'spices'), true);
  assert.equal(options.some((option) => option.value === 'other'), true);
}

function testCopyCoverage(): void {
  const appEn = getAppCopy('en');
  const appHi = getAppCopy('hi');
  const ownerEn = getOwnerCopy('en');
  const ownerHi = getOwnerCopy('hi');
  const cookEn = getCookCopy('en');
  const cookHi = getCookCopy('hi');

  assert.ok(appEn.signInWithGoogle.length > 0);
  assert.ok(appHi.signInWithGoogle.length > 0);
  assert.ok(ownerEn.title.length > 0);
  assert.ok(ownerHi.title.length > 0);
  assert.ok(cookEn.smartAssistant.length > 0);
  assert.ok(cookHi.smartAssistant.length > 0);
}

function testAiParseValidationAcceptsMixedResult(): void {
  const result = validateAiParseResult({
    understood: true,
    message: 'Applied updates.',
    updates: [
      {
        itemId: 'atta',
        newStatus: 'low',
        requestedQuantity: '4kg',
      },
      {
        itemId: 'tomatoes',
        newStatus: 'out',
      },
    ],
    unlistedItems: [
      {
        name: 'Jeera',
        status: 'low',
        category: 'Spices',
        requestedQuantity: '200g',
      },
    ],
  });

  assert.deepEqual(result, {
    understood: true,
    message: 'Applied updates.',
    updates: [
      {
        itemId: 'atta',
        newStatus: 'low',
        requestedQuantity: '4kg',
      },
      {
        itemId: 'tomatoes',
        newStatus: 'out',
        requestedQuantity: undefined,
      },
    ],
    unlistedItems: [
      {
        name: 'Jeera',
        status: 'low',
        category: 'Spices',
        requestedQuantity: '200g',
      },
    ],
  });
}

function testAiParseValidationRejectsInvalidUnderstoodType(): void {
  assert.throws(
    () =>
      validateAiParseResult({
        understood: 'true',
        updates: [],
        unlistedItems: [],
      }),
    /AI response missing understood boolean\./,
  );
}

function testAiParseValidationRejectsOversizedRequestedQuantity(): void {
  assert.throws(
    () =>
      validateAiParseResult({
        understood: true,
        updates: [
          {
            itemId: 'atta',
            newStatus: 'low',
            requestedQuantity: 'x'.repeat(201),
          },
        ],
        unlistedItems: [],
      }),
    /AI update requestedQuantity is invalid\./,
  );
}

function testLocalizedCategoryLabels(): void {
  assert.equal(getLocalizedCategoryName('staples', 'en'), 'Main Ration');
  assert.equal(getLocalizedCategoryName('staples', 'hi'), 'मुख्य राशन');
  assert.equal(getLocalizedCategoryName('milk', 'hi'), 'डेयरी');
  assert.equal(getPantryCategoryLabel('milk').includes('डेयरी'), true);
}

function withMockedRandomUUID<T>(value: string, callback: () => T): T {
  const originalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: () => value,
    },
  });

  try {
    return callback();
  } finally {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  }
}

function testBuildPantryLogIsDeterministic(): void {
  const log = withMockedRandomUUID('mock-log-id', () =>
    buildPantryLog({
      itemId: 'tomatoes',
      itemName: 'Tomatoes',
      oldStatus: 'in-stock',
      newStatus: 'low',
      role: 'owner',
      timestampIso: '2026-03-25T10:00:00.000Z',
    }),
  );

  assert.deepEqual(log, {
    id: 'mock-log-id',
    itemId: 'tomatoes',
    itemName: 'Tomatoes',
    oldStatus: 'in-stock',
    newStatus: 'low',
    timestamp: '2026-03-25T10:00:00.000Z',
    role: 'owner',
  });
}

function testSanitizeFirestorePayloadOmitsUndefinedFields(): void {
  const payload = sanitizeFirestorePayload({
    status: 'low' as const,
    lastUpdated: '2026-03-25T10:05:00.000Z',
    updatedBy: 'cook' as const,
    requestedQuantity: undefined,
    anomalyReason: '',
  });

  assert.deepEqual(payload, {
    status: 'low',
    lastUpdated: '2026-03-25T10:05:00.000Z',
    updatedBy: 'cook',
    anomalyReason: '',
  });
}

function testIngredientVisualCatalogMatch(): void {
  const visual = resolveIngredientVisual({
    name: 'Turmeric (Haldi)',
    nameHi: 'हल्दी',
    category: 'spices',
  });

  assert.equal(visual.source, 'catalog-match');
  assert.equal(visual.fallbackIcon, '🟡');
  assert.equal(visual.altText.includes('turmeric'), true);
  assert.equal(visual.catalogMatch?.canonicalName, 'Turmeric');
  assert.equal(visual.catalogMatch?.transliteration, 'Haldi');
  assert.equal(visual.catalogMatch?.nativeName, 'हल्दी');
  assert.equal(visual.imageUrl, 'https://cdn.example.com/rasoi/ingredients/turmeric.webp');
}

function testIngredientVisualMissingBaseUrlUsesFallbackWithoutThrowing(): void {
  const previousValue = process.env.VITE_INGREDIENT_IMAGE_BASE_URL;
  delete process.env.VITE_INGREDIENT_IMAGE_BASE_URL;

  try {
    const visual = resolveIngredientVisual({
      name: 'Turmeric',
      category: 'spices',
    });

    assert.equal(visual.source, 'catalog-match');
    assert.equal(visual.fallbackIcon, '🟡');
    assert.equal(visual.imageUrl, null);
  } finally {
    process.env.VITE_INGREDIENT_IMAGE_BASE_URL = previousValue;
  }
}

function testIngredientVisualInvalidBaseUrlUsesFallbackWithoutThrowing(): void {
  const previousValue = process.env.VITE_INGREDIENT_IMAGE_BASE_URL;
  process.env.VITE_INGREDIENT_IMAGE_BASE_URL = 'ftp://invalid';

  try {
    const visual = resolveIngredientVisual({
      name: 'Turmeric',
      category: 'spices',
    });

    assert.equal(visual.source, 'catalog-match');
    assert.equal(visual.fallbackIcon, '🟡');
    assert.equal(visual.imageUrl, null);
  } finally {
    process.env.VITE_INGREDIENT_IMAGE_BASE_URL = previousValue;
  }
}

function testIngredientVisualHindiMatch(): void {
  const visual = resolveIngredientVisual({
    name: 'Requested item',
    nameHi: 'नमक',
    category: 'other',
  });

  assert.equal(visual.source, 'catalog-match');
  assert.equal(visual.fallbackIcon, '🧂');
  assert.equal(visual.altText.includes('salt'), true);
  assert.equal(visual.catalogMatch?.canonicalName, 'Salt');
  assert.equal(visual.catalogMatch?.matchedKeyword, 'नमक');
}

function testExpandedIngredientVisualCoverage(): void {
  const cases = [
    { input: { name: 'Jeera', category: 'spices' }, expectedKey: 'cumin', expectedName: 'Cumin Seeds', expectedNativeName: 'जीरा' },
    { input: { name: 'Sarson ka tel', category: 'staples' }, expectedKey: 'mustard-oil', expectedName: 'Mustard Oil', expectedNativeName: 'सरसों का तेल' },
    { input: { name: 'Rajma', category: 'pulses' }, expectedKey: 'rajma', expectedName: 'Kidney Beans', expectedNativeName: 'राजमा' },
    { input: { name: 'दही', category: 'dairy' }, expectedKey: 'curd', expectedName: 'Curd', expectedNativeName: 'दही' },
    { input: { name: 'Hara Dhaniya', category: 'veggies' }, expectedKey: 'coriander-leaves', expectedName: 'Coriander Leaves', expectedNativeName: 'हरा धनिया' },
    { input: { name: 'Besan', category: 'staples' }, expectedKey: 'besan', expectedName: 'Gram Flour', expectedNativeName: 'बेसन' },
  ] as const;

  for (const testCase of cases) {
    const visual = resolveIngredientVisual(testCase.input);

    assert.equal(visual.source, 'catalog-match');
    assert.equal(visual.catalogMatch?.key, testCase.expectedKey);
    assert.equal(visual.catalogMatch?.canonicalName, testCase.expectedName);
    assert.equal(visual.catalogMatch?.nativeName, testCase.expectedNativeName);
  }
}

function testIngredientVisualChoosesMostSpecificKeyword(): void {
  const visual = resolveIngredientVisual({
    name: 'Kala Namak',
    category: 'spices',
  });

  assert.equal(visual.source, 'catalog-match');
  assert.equal(visual.catalogMatch?.key, 'black-salt');
  assert.equal(visual.catalogMatch?.canonicalName, 'Black Salt');
}

function testIngredientNativeContextLabel(): void {
  const visual = resolveIngredientVisual({
    name: 'Jeera',
    category: 'spices',
  });

  assert.equal(getIngredientNativeContextLabel({}, visual), 'Jeera / जीरा');
  assert.equal(getIngredientNativeContextLabel({ nameHi: 'जीरा' }, visual), 'Jeera / जीरा');
}

function testIngredientVisualExistingIconFallback(): void {
  const visual = resolveIngredientVisual({
    name: 'Future Pantry Item',
    category: 'spices',
    icon: '🌿',
  });

  assert.equal(visual.source, 'existing-icon');
  assert.equal(visual.imageUrl, null);
  assert.equal(visual.fallbackIcon, '🌿');
  assert.equal(visual.catalogMatch, undefined);
}

function testIngredientVisualCategoryFallback(): void {
  const visual = resolveIngredientVisual({
    name: 'Unknown packet',
    category: 'other',
  });

  assert.equal(visual.source, 'category-fallback');
  assert.equal(visual.imageUrl, null);
  assert.equal(visual.fallbackIcon, '📦');
  assert.equal(visual.catalogMatch, undefined);
}

function testUnknownQueueErrorParsingAndMessaging(): void {
  const permissionDenied = toFirestoreListenerErrorInfo({
    code: 'permission-denied',
    message: 'Missing or insufficient permissions.',
    name: 'FirebaseError',
  });
  assert.equal(isFirestorePermissionDeniedError(permissionDenied), true);
  assert.equal(getUnknownQueueLoadErrorMessage(permissionDenied), 'Unknown ingredient queue access denied. Deploy latest Firestore rules and retry.');

  const failedPrecondition = toFirestoreListenerErrorInfo({
    code: 'failed-precondition',
    message: 'The query requires an index.',
    name: 'FirebaseError',
  });
  assert.equal(isFirestoreFailedPreconditionError(failedPrecondition), true);
  assert.equal(getUnknownQueueLoadErrorMessage(failedPrecondition), 'Unknown ingredient queue index is missing. Showing fallback order while index is provisioned.');

  const unknownError = toFirestoreListenerErrorInfo(new Error('boom'));
  assert.equal(isFirestoreFailedPreconditionError(unknownError), false);
  assert.equal(isFirestorePermissionDeniedError(unknownError), false);
  assert.equal(getUnknownQueueLoadErrorMessage(unknownError), 'Failed to load unknown ingredient queue.');
}

function testUnknownQueueFallbackSortOrder(): void {
  const sorted = sortUnknownIngredientQueueItemsByCreatedAt([
    {
      id: 'queue-2',
      name: 'A',
      category: 'spices',
      status: 'open',
      requestedStatus: 'low',
      createdAt: '2026-03-25T08:00:00.000Z',
      createdBy: 'cook',
    },
    {
      id: 'queue-1',
      name: 'B',
      category: 'staples',
      status: 'open',
      requestedStatus: 'low',
      createdAt: '2026-03-25T10:00:00.000Z',
      createdBy: 'owner',
    },
    {
      id: 'queue-3',
      name: 'C',
      category: 'veggies',
      status: 'open',
      requestedStatus: 'out',
      createdAt: 'invalid-date',
      createdBy: 'cook',
    },
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ['queue-1', 'queue-2', 'queue-3']);
}

function run(): void {
  testPantryCategoryNormalization();
  testPantryCategoryLabels();
  testPantryCategoryOptions();
  testCopyCoverage();
  testAiParseValidationAcceptsMixedResult();
  testAiParseValidationRejectsInvalidUnderstoodType();
  testAiParseValidationRejectsOversizedRequestedQuantity();
  testLocalizedCategoryLabels();
  testBuildPantryLogIsDeterministic();
  testSanitizeFirestorePayloadOmitsUndefinedFields();
  testIngredientVisualCatalogMatch();
  testIngredientVisualMissingBaseUrlUsesFallbackWithoutThrowing();
  testIngredientVisualInvalidBaseUrlUsesFallbackWithoutThrowing();
  testIngredientVisualHindiMatch();
  testExpandedIngredientVisualCoverage();
  testIngredientVisualChoosesMostSpecificKeyword();
  testIngredientNativeContextLabel();
  testIngredientVisualExistingIconFallback();
  testIngredientVisualCategoryFallback();
  testUnknownQueueErrorParsingAndMessaging();
  testUnknownQueueFallbackSortOrder();
  console.log('All unit tests passed.');
}

run();
function testIngredientVisualMixedLanguageCuminMatch(): void {
  const visual = resolveIngredientVisual({
    name: 'Cumin Seeds',
    nameHi: 'जीरा',
    category: 'other',
  });

  assert.equal(visual.source, 'catalog-match');
  assert.equal(visual.fallbackIcon, '🟤');
  assert.equal(visual.altText.includes('cumin'), true);
}

function testIngredientVisualFutureIngredientFallback(): void {
  const visual = resolveIngredientVisual({
    name: 'Curry Leaves',
    nameHi: 'करी पत्ता',
    category: 'veggies',
  });

  assert.equal(visual.source, 'category-fallback');
  assert.equal(visual.imageUrl, null);
  assert.equal(visual.fallbackIcon, '🥕');
}

function testIngredientVisualPunctuatedVariantMatch(): void {
  const visual = resolveIngredientVisual({
    name: 'Red Chilli Powder (Kashmiri)',
    nameHi: 'लाल मिर्च',
    category: 'spices',
  });

  assert.equal(visual.source, 'catalog-match');
  assert.equal(visual.fallbackIcon, '🌶️');
  assert.equal(visual.altText.includes('red chilli'), true);
}

function testPantryCategoryMatchesMixedLanguageQueries(): void {
  assert.equal(pantryCategoryMatchesSearch('veggies', 'sabzi'), true);
  assert.equal(pantryCategoryMatchesSearch('veggies', 'सब्ज़ियाँ'), true);
  assert.equal(pantryCategoryMatchesSearch('staples', 'main ration'), true);
}

function runQAFollowUpTests(): void {
  testIngredientVisualMixedLanguageCuminMatch();
  testIngredientVisualFutureIngredientFallback();
  testIngredientVisualPunctuatedVariantMatch();
  testPantryCategoryMatchesMixedLanguageQueries();
  console.log('QA follow-up unit tests passed.');
}

runQAFollowUpTests();
