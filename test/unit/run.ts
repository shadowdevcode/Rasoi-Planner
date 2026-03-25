import assert from 'node:assert/strict';
import { getAppCopy, getCookCopy, getOwnerCopy } from '../../src/i18n/copy';
import {
  getPantryCategoryLabel,
  getPantryCategoryOptions,
  normalizePantryCategory,
  pantryCategoryMatchesSearch,
} from '../../src/utils/pantryCategory';

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

function run(): void {
  testPantryCategoryNormalization();
  testPantryCategoryLabels();
  testPantryCategoryOptions();
  testCopyCoverage();
  console.log('All unit tests passed.');
}

run();
