import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const projectRoot = process.cwd();
const artifactsDir = path.join(projectRoot, 'test/e2e/artifacts');
const summaryPath = path.join(artifactsDir, 'summary.json');
const baseUrl = 'http://127.0.0.1:3000';
const systemChromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const serverStartupTimeoutMs = 30000;
const uiTimeoutMs = 10000;
const pageViewport = {
  width: 1440,
  height: 1200,
};
const mobileViewport = {
  width: 390,
  height: 844,
};

function parseBooleanEnv(value, fallbackValue) {
  if (value === undefined) {
    return fallbackValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }

  return fallbackValue;
}

function parseNumberEnv(value) {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function tailText(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(value.length - maxLength);
}

function formatError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'Error',
    message: String(error),
  };
}

function resolveBrowserExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  if (existsSync(systemChromeExecutable)) {
    return systemChromeExecutable;
  }

  return puppeteer.executablePath();
}

async function writeSummary(summary) {
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
}

async function waitForServer(url, timeoutMs, serverProcess, getServerOutput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(
        `Dev server exited before becoming ready. exitCode=${serverProcess.exitCode ?? 'null'} signalCode=${serverProcess.signalCode ?? 'null'} output=${tailText(getServerOutput(), 8000)}`,
      );
    }

    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok) {
        return;
      }
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw error;
      }
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${url}. Last server output: ${tailText(getServerOutput(), 8000)}`);
}

async function resetBrowserState(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: uiTimeoutMs });
}

async function waitForText(page, expectedText, timeoutMs) {
  await page.waitForFunction(
    (text) => (document.body?.innerText ?? '').includes(text),
    { timeout: timeoutMs },
    expectedText,
  );
}

async function waitForTextToDisappear(page, expectedText, timeoutMs) {
  await page.waitForFunction(
    (text) => !(document.body?.innerText ?? '').includes(text),
    { timeout: timeoutMs },
    expectedText,
  );
}

async function waitForAnyText(page, expectedTexts, timeoutMs) {
  await page.waitForFunction(
    (texts) => texts.some((text) => (document.body?.innerText ?? '').includes(text)),
    { timeout: timeoutMs },
    expectedTexts,
  );
}

async function waitForGroceryItemToDisappear(page, itemName, timeoutMs) {
  await page.waitForFunction(
    (expectedItemName) => {
      const heading = Array.from(document.querySelectorAll('h2')).find((item) => item.textContent?.includes('Grocery List'));
      if (!(heading instanceof HTMLElement)) {
        return false;
      }
      const section = heading.closest('div');
      if (!(section instanceof HTMLElement)) {
        return false;
      }
      const listItems = Array.from(section.querySelectorAll('li'));
      if (listItems.length === 0) {
        return true;
      }
      return !listItems.some((item) => (item.textContent ?? '').includes(expectedItemName));
    },
    { timeout: timeoutMs },
    itemName,
  );
}

async function clickExactText(page, selector, expectedText) {
  const didClick = await page.evaluate(
    ({ cssSelector, text }) => {
      const normalize = (value) => value.replace(/\s+/g, ' ').trim();
      const targetText = normalize(text);
      const candidate = Array.from(document.querySelectorAll(cssSelector)).find((element) => (
        element instanceof HTMLElement
        && element.getClientRects().length > 0
        && normalize(element.textContent ?? '') === targetText
      ));

      if (!(candidate instanceof HTMLElement)) {
        return false;
      }

      candidate.click();
      return true;
    },
    { cssSelector: selector, text: expectedText },
  );

  if (!didClick) {
    throw new Error(`Unable to click ${selector} with text "${expectedText}".`);
  }
}

async function fillByPlaceholder(page, placeholder, value) {
  const selector = `[placeholder="${placeholder}"]`;
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (value.length > 0) {
    await page.type(selector, value);
  }
}

async function fillByTestId(page, testId, value) {
  const selector = `[data-testid="${testId}"]`;
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (value.length > 0) {
    await page.type(selector, value);
  }
}

async function clickByTestId(page, testId) {
  const selector = `[data-testid="${testId}"]`;
  await page.waitForSelector(selector);
  await page.click(selector);
}

async function setSelectByTestId(page, testId, nextValue) {
  const selector = `[data-testid="${testId}"]`;
  await page.waitForSelector(selector);
  await page.evaluate(
    ({ cssSelector, value }) => {
      const select = document.querySelector(cssSelector);
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error(`Select not found: ${cssSelector}`);
      }
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { cssSelector: selector, value: nextValue },
  );
}

async function waitForOwnerTabSelection(page, tabTestId, panelId, timeoutMs) {
  const tabSelector = `[data-testid="${tabTestId}"]`;
  const panelSelector = `#${panelId}`;
  await page.waitForFunction(
    ({ tabCss, panelCss }) => {
      const tab = document.querySelector(tabCss);
      const panel = document.querySelector(panelCss);
      if (!(tab instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
        return false;
      }
      const isSelected = tab.getAttribute('aria-selected') === 'true';
      const isVisible = panel.hidden === false;
      return isSelected && isVisible;
    },
    { timeout: timeoutMs },
    { tabCss: tabSelector, panelCss: panelSelector },
  );
}

async function setRowSelectValue(page, rowText, nextValue) {
  const didUpdate = await page.evaluate(
    ({ expectedRowText, value }) => {
      const normalize = (input) => input.replace(/\s+/g, ' ').trim();
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows.find((element) => (
        element instanceof HTMLElement
        && normalize(element.textContent ?? '').includes(expectedRowText)
      ));

      if (!(row instanceof HTMLElement)) {
        return false;
      }

      const select = row.querySelector('select');
      if (!(select instanceof HTMLSelectElement)) {
        return false;
      }

      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    { expectedRowText: rowText, value: nextValue },
  );

  if (!didUpdate) {
    throw new Error(`Unable to set select for row containing "${rowText}".`);
  }
}

async function clickTableRowButton(page, rowText, buttonText) {
  const clicked = await page.evaluate(
    ({ expectedRowText, expectedButtonText }) => {
      const normalize = (input) => input.replace(/\s+/g, ' ').trim();
      const rows = Array.from(document.querySelectorAll('li, tr'));
      const row = rows.find((element) => (
        element instanceof HTMLElement
        && normalize(element.textContent ?? '').includes(expectedRowText)
        && Array.from(element.querySelectorAll('button')).some((button) => normalize(button.textContent ?? '') === expectedButtonText)
      ));

      if (!(row instanceof HTMLElement)) {
        return false;
      }

      const button = Array.from(row.querySelectorAll('button')).find((element) => normalize(element.textContent ?? '') === expectedButtonText);
      if (!(button instanceof HTMLElement)) {
        return false;
      }

      button.click();
      return true;
    },
    { expectedRowText: rowText, expectedButtonText: buttonText },
  );

  if (!clicked) {
    throw new Error(`Unable to click button "${buttonText}" for row containing "${rowText}".`);
  }
}

async function setCookStatus(page, itemText, buttonText) {
  const didClick = await page.evaluate(
    ({ expectedItemText, expectedButtonText }) => {
      const normalize = (input) => input.replace(/\s+/g, ' ').trim();
      const statusLabels = expectedButtonText === 'Full'
        ? ['Full', 'पूरा है']
        : expectedButtonText === 'Low'
          ? ['Low', 'कम है']
          : expectedButtonText === 'Empty'
            ? ['Empty', 'खत्म']
            : [expectedButtonText];
      const cards = Array.from(document.querySelectorAll('section div'));
      const card = cards.find((element) => (
        element instanceof HTMLElement
        && normalize(element.textContent ?? '').includes(expectedItemText)
        && Array.from(element.querySelectorAll('button')).some((button) => statusLabels.includes(normalize(button.textContent ?? '')))
      ));

      if (!(card instanceof HTMLElement)) {
        return false;
      }

      const button = Array.from(card.querySelectorAll('button')).find((element) => statusLabels.includes(normalize(element.textContent ?? '')));
      if (!(button instanceof HTMLElement)) {
        return false;
      }

      button.click();
      return true;
    },
    { expectedItemText: itemText, expectedButtonText: buttonText },
  );

  if (!didClick) {
    throw new Error(`Unable to set cook status ${buttonText} for ${itemText}.`);
  }
}

async function setCookNote(page, itemText, noteValue) {
  const didOpen = await page.evaluate((expectedItemText) => {
    const normalize = (input) => input.replace(/\s+/g, ' ').trim();
    const cards = Array.from(document.querySelectorAll('section div'));
    const card = cards.find((element) => (
      element instanceof HTMLElement
      && normalize(element.textContent ?? '').includes(expectedItemText)
      && Array.from(element.querySelectorAll('button')).some((button) => {
        const text = normalize(button.textContent ?? '');
        return text === 'Add Note' || text.startsWith('Note:') || text === 'नोट लिखें' || text.startsWith('नोट:');
      })
    ));

    if (!(card instanceof HTMLElement)) {
      return false;
    }

    const button = Array.from(card.querySelectorAll('button')).find((element) => {
      const text = normalize(element.textContent ?? '');
      return text === 'Add Note' || text.startsWith('Note:') || text === 'नोट लिखें' || text.startsWith('नोट:');
    });
    if (!(button instanceof HTMLElement)) {
      return false;
    }

    button.click();
    return true;
  }, itemText);

  if (!didOpen) {
    throw new Error(`Unable to open note editor for ${itemText}.`);
  }

  const noteSelector = 'input[placeholder="Quantity? (e.g. 2kg)"], input[placeholder="कितना चाहिए? (उदा: 2kg)"]';
  await page.waitForSelector(noteSelector);
  await page.evaluate(() => {
    const target = document.querySelector('input[placeholder="Quantity? (e.g. 2kg)"], input[placeholder="कितना चाहिए? (उदा: 2kg)"]');
    if (!(target instanceof HTMLInputElement)) {
      throw new Error('Note input not found.');
    }
    target.focus();
    target.select();
  });
  await page.keyboard.press('Backspace');
  await page.type('input[placeholder="Quantity? (e.g. 2kg)"], input[placeholder="कितना चाहिए? (उदा: 2kg)"]', noteValue);
  await page.waitForSelector('button[title="Save"], button[title="सेव"]');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveButton = buttons.find((element) => {
      const title = element.getAttribute('title');
      return title === 'Save' || title === 'सेव';
    });

    if (!(saveButton instanceof HTMLElement)) {
      throw new Error('Save button not found.');
    }

    saveButton.click();
  });
}

async function captureFailure(page, scenarioName, error) {
  const screenshotPath = path.join(artifactsDir, `${scenarioName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return {
    error: formatError(error),
    screenshotPath,
  };
}

async function runOwnerCoreFlow(page) {
  const repro = [
    'Open /?e2e-role=owner.',
    'Click "Sign in with Google".',
    'Edit the first morning meal entry and save leftovers/notes.',
    'Open Grocery List and mark Tomatoes as bought.',
    'Open Pantry & Logs, add Jeera, then mark it Running Low.',
    'Open Activity Logs and verify the new entry is shown.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=owner`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Owner View', uiTimeoutMs);
  await waitForText(page, 'Household Settings', uiTimeoutMs);
  await fillByTestId(page, 'meal-day-0-morning', 'E2E Poha and fruit');
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('[data-testid="meal-day-0-morning"]')).some((element) => element instanceof HTMLTextAreaElement && element.value === 'E2E Poha and fruit'),
    { timeout: uiTimeoutMs },
  );
  await fillByTestId(page, 'meal-day-0-leftovers', 'E2E leftover dal');
  await page.keyboard.press('Tab');
  await fillByTestId(page, 'meal-day-0-notes', 'E2E less spice for kids');
  await page.keyboard.press('Tab');
  await sleep(700);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Owner View', uiTimeoutMs);
  await page.waitForFunction(
    () => {
      const leftovers = document.querySelector('[data-testid="meal-day-0-leftovers"]');
      const notes = document.querySelector('[data-testid="meal-day-0-notes"]');
      return leftovers instanceof HTMLTextAreaElement
        && notes instanceof HTMLTextAreaElement
        && leftovers.value === 'E2E leftover dal'
        && notes.value === 'E2E less spice for kids';
    },
    { timeout: uiTimeoutMs },
  );

  await clickByTestId(page, 'owner-tab-grocery');
  await waitForText(page, 'Tomatoes', uiTimeoutMs);
  await clickTableRowButton(page, 'Tomatoes', 'Mark Bought');
  await waitForText(page, 'Pantry status updated.', uiTimeoutMs);
  await waitForGroceryItemToDisappear(page, 'Tomatoes', uiTimeoutMs);

  await clickByTestId(page, 'owner-tab-pantry');
  await waitForText(page, 'Pantry Management', uiTimeoutMs);
  await fillByPlaceholder(page, 'Ingredient name (e.g., Jeera)', 'Jeera');
  await fillByPlaceholder(page, 'Default Size (e.g., 500g)', '500g');
  await clickExactText(page, 'button', 'Add Item');
  await waitForText(page, 'Jeera', uiTimeoutMs);
  await setRowSelectValue(page, 'Jeera', 'low');
  await waitForText(page, 'Pantry status updated.', uiTimeoutMs);
  await clickExactText(page, 'button', 'Activity Logs');
  await waitForText(page, 'Jeera', uiTimeoutMs);

  return {
    name: 'owner-core-journey',
    pass: true,
    repro,
  };
}

async function runCookCoreFlow(page) {
  const repro = [
    'Open /?e2e-role=cook.',
    'Click "Sign in with Google".',
    'Use default cook language profile.',
    'Use Smart Assistant with the standard pantry update prompt.',
    'Search tomatoes, mark it Full, add a note for atta, and verify the note is rendered.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await waitForAnyText(page, ["Today's Menu", 'आज का मेनू'], uiTimeoutMs);
  await fillByTestId(page, 'cook-ai-input', 'Tamatar aur atta khatam ho gaya hai, dhania 2 bunch chahiye');
  await clickByTestId(page, 'cook-ai-submit');
  await waitForAnyText(page, ['Updated successfully!', 'अपडेट हो गया!'], uiTimeoutMs);

  await fillByTestId(page, 'cook-pantry-search', 'Tomatoes');
  await waitForText(page, 'Tomatoes', uiTimeoutMs);
  await setCookStatus(page, 'Tomatoes', 'Full');
  await waitForAnyText(page, ['Tomatoes ➔ Full', 'टमाटर ➔ पूरा है', 'Tomatoes ➔ पूरा है'], uiTimeoutMs);

  await fillByTestId(page, 'cook-pantry-search', 'Atta');
  await waitForText(page, 'Atta', uiTimeoutMs);
  await setCookNote(page, 'Atta', '3kg');
  await waitForAnyText(page, ['Note: 3kg', 'नोट: 3kg'], uiTimeoutMs);

  return {
    name: 'cook-ai-journey',
    pass: true,
    repro,
  };
}

async function runMalformedAiResponseCheck(page) {
  const repro = [
    'Open /?e2e-role=cook.',
    'Click "Sign in with Google".',
    'Use default cook language profile.',
    'Submit the malformed AI marker prompt.',
    'Verify the safe AI error message is rendered and the page stays usable.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await waitForAnyText(page, ["Today's Menu", 'आज का मेनू'], uiTimeoutMs);
  await fillByTestId(page, 'cook-ai-input', '__e2e_malformed_ai__');
  await clickByTestId(page, 'cook-ai-submit');
  await waitForAnyText(
    page,
    [
      'Could not process AI response safely. Please retry with clearer input.',
      'AI update failed. Please retry.',
    ],
    uiTimeoutMs,
  );

  return {
    name: 'ai-malformed-response',
    pass: true,
    repro,
  };
}

async function runUnmatchedItemWarningCheck(page) {
  const repro = [
    'Open /?e2e-role=cook.',
    'Click "Sign in with Google".',
    'Use default cook language profile.',
    'Submit the unmatched item marker prompt.',
    'Verify the successful update path runs and Milk moves onto the list.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await waitForAnyText(page, ["Today's Menu", 'आज का मेनू'], uiTimeoutMs);
  await fillByTestId(page, 'cook-ai-input', '__e2e_unmatched_item__');
  await clickByTestId(page, 'cook-ai-submit');
  await waitForAnyText(page, ['Updated successfully!', 'अपडेट हो गया!'], uiTimeoutMs);
  await fillByTestId(page, 'cook-pantry-search', 'Milk');
  await waitForText(page, 'Milk', uiTimeoutMs);
  await waitForAnyText(page, ['On List', 'सूची में है'], uiTimeoutMs);

  return {
    name: 'ai-unmatched-item-warning',
    pass: true,
    repro,
  };
}

async function runNoteSavePathCheck(page) {
  const repro = [
    'Open /?e2e-role=cook.',
    'Click "Sign in with Google".',
    'Use default cook language profile.',
    'Search for Atta.',
    'Add a note and save it.',
    'Verify the note renders as saved quantity text.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await waitForAnyText(page, ["Today's Menu", 'आज का मेनू'], uiTimeoutMs);
  await fillByTestId(page, 'cook-pantry-search', 'Atta');
  await waitForText(page, 'Atta', uiTimeoutMs);
  await setCookNote(page, 'Atta', '4kg');
  await waitForAnyText(page, ['Note: 4kg', 'नोट: 4kg'], uiTimeoutMs);

  return {
    name: 'note-save-path',
    pass: true,
    repro,
  };
}

async function runRemoveFromGroceryPathCheck(page) {
  const repro = [
    'Open /?e2e-role=owner.',
    'Click "Sign in with Google".',
    'Open Grocery List.',
    'Mark Tomatoes as bought.',
    'Verify Tomatoes is removed from the grocery list.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=owner`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Owner View', uiTimeoutMs);
  await clickByTestId(page, 'owner-tab-grocery');
  await waitForText(page, 'Tomatoes', uiTimeoutMs);
  await clickTableRowButton(page, 'Tomatoes', 'Mark Bought');
  await waitForText(page, 'Pantry status updated.', uiTimeoutMs);
  await waitForGroceryItemToDisappear(page, 'Tomatoes', uiTimeoutMs);

  return {
    name: 'remove-from-grocery-path',
    pass: true,
    repro,
  };
}

async function runOwnerTabKeyboardNavigationCheck(page) {
  const repro = [
    'Open /?e2e-role=owner and sign in.',
    'Focus owner tabs and navigate with ArrowRight, End, and Home.',
    'Verify selected tab and panel mapping after each keypress.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=owner`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Owner View', uiTimeoutMs);

  await page.focus('[data-testid="owner-tab-meals"]');
  await page.keyboard.press('ArrowRight');
  await waitForOwnerTabSelection(page, 'owner-tab-grocery', 'owner-panel-grocery', uiTimeoutMs);
  await page.keyboard.press('End');
  await waitForOwnerTabSelection(page, 'owner-tab-pantry', 'owner-panel-pantry', uiTimeoutMs);
  await page.keyboard.press('Home');
  await waitForOwnerTabSelection(page, 'owner-tab-meals', 'owner-panel-meals', uiTimeoutMs);

  return {
    name: 'owner-tab-keyboard-navigation',
    pass: true,
    repro,
  };
}

async function runOwnerTabKeyboardNavigationMobileCheck(page) {
  const repro = [
    'Open /?e2e-role=owner on mobile viewport and sign in.',
    'Navigate owner tabs with keyboard keys.',
    'Verify tab selection and active panel on mobile layout.',
  ];

  await page.setViewport(mobileViewport);
  await page.goto(`${baseUrl}/?e2e-role=owner`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Owner View', uiTimeoutMs);

  await page.focus('[data-testid="owner-tab-meals"]');
  await page.keyboard.press('ArrowRight');
  await waitForOwnerTabSelection(page, 'owner-tab-grocery', 'owner-panel-grocery', uiTimeoutMs);
  await page.keyboard.press('End');
  await waitForOwnerTabSelection(page, 'owner-tab-pantry', 'owner-panel-pantry', uiTimeoutMs);
  await page.keyboard.press('Home');
  await waitForOwnerTabSelection(page, 'owner-tab-meals', 'owner-panel-meals', uiTimeoutMs);

  return {
    name: 'owner-tab-keyboard-navigation-mobile',
    pass: true,
    repro,
  };
}

async function runOwnerPantryMobileCardWorkflowCheck(page) {
  const repro = [
    'Open /?e2e-role=owner on mobile viewport and sign in.',
    'Open Pantry tab and update Tomatoes through mobile card status select.',
    'Verify pantry update success feedback is shown.',
  ];

  await page.setViewport(mobileViewport);
  await page.goto(`${baseUrl}/?e2e-role=owner`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="sign-in-button"]', { timeout: uiTimeoutMs });
  await clickByTestId(page, 'sign-in-button');
  await waitForText(page, 'Owner View', uiTimeoutMs);
  await clickByTestId(page, 'owner-tab-pantry');
  await waitForText(page, 'Pantry Management', uiTimeoutMs);
  await setSelectByTestId(page, 'pantry-mobile-status-9', 'in-stock');
  await waitForText(page, 'Pantry status updated.', uiTimeoutMs);
  await page.waitForSelector('[data-testid="pantry-mobile-card-9"]', { timeout: uiTimeoutMs });

  return {
    name: 'owner-pantry-mobile-card-workflow',
    pass: true,
    repro,
  };
}

async function runScenario(browser, scenario) {
  const page = await browser.newPage();
  page.setDefaultTimeout(uiTimeoutMs);
  page.setDefaultNavigationTimeout(serverStartupTimeoutMs);

  try {
    await resetBrowserState(page);
    return await scenario.run(page);
  } catch (error) {
    const failure = await captureFailure(page, scenario.name, error);
    return {
      name: scenario.name,
      pass: false,
      repro: scenario.repro,
      ...failure,
    };
  } finally {
    await page.close();
  }
}

const scenarios = [
  {
    name: 'owner-core-journey',
    repro: [
      'Open /?e2e-role=owner.',
      'Click "Sign in with Google".',
      'Edit the first morning meal entry.',
      'Open Grocery List and mark Tomatoes as bought.',
      'Open Pantry & Logs, add Jeera, then mark it Running Low.',
      'Open Activity Logs and verify the new entry is shown.',
    ],
    run: runOwnerCoreFlow,
  },
  {
    name: 'cook-ai-journey',
    repro: [
      'Open /?e2e-role=cook.',
      'Click "Sign in with Google".',
      'Use default cook language profile.',
      'Use Smart Assistant with the standard pantry update prompt.',
      'Search tomatoes, mark it Full, add a note for atta, and verify the note is rendered.',
    ],
    run: runCookCoreFlow,
  },
  {
    name: 'ai-malformed-response',
    repro: [
      'Open /?e2e-role=cook.',
      'Click "Sign in with Google".',
      'Use default cook language profile.',
      'Submit the malformed AI marker prompt.',
      'Verify the safe AI error message is rendered and the page stays usable.',
    ],
    run: runMalformedAiResponseCheck,
  },
  {
    name: 'ai-unmatched-item-warning',
    repro: [
      'Open /?e2e-role=cook.',
      'Click "Sign in with Google".',
      'Use default cook language profile.',
      'Submit the unmatched item marker prompt.',
      'Verify the successful update path runs and Milk moves onto the list.',
    ],
    run: runUnmatchedItemWarningCheck,
  },
  {
    name: 'note-save-path',
    repro: [
      'Open /?e2e-role=cook.',
      'Click "Sign in with Google".',
      'Use default cook language profile.',
      'Search for Atta.',
      'Add a note and save it.',
      'Verify the note renders as saved quantity text.',
    ],
    run: runNoteSavePathCheck,
  },
  {
    name: 'remove-from-grocery-path',
    repro: [
      'Open /?e2e-role=owner.',
      'Click "Sign in with Google".',
      'Open Grocery List.',
      'Mark Tomatoes as bought.',
      'Verify Tomatoes is removed from the grocery list.',
    ],
    run: runRemoveFromGroceryPathCheck,
  },
  {
    name: 'owner-tab-keyboard-navigation',
    repro: [
      'Open /?e2e-role=owner and sign in.',
      'Navigate owner tabs with keyboard arrows and Home/End.',
      'Verify tab and panel selection updates.',
    ],
    run: runOwnerTabKeyboardNavigationCheck,
  },
  {
    name: 'owner-tab-keyboard-navigation-mobile',
    repro: [
      'Open /?e2e-role=owner on mobile viewport and sign in.',
      'Navigate owner tabs with keyboard arrows and Home/End.',
      'Verify tab and panel selection updates on mobile.',
    ],
    run: runOwnerTabKeyboardNavigationMobileCheck,
  },
  {
    name: 'owner-pantry-mobile-card-workflow',
    repro: [
      'Open /?e2e-role=owner on mobile viewport and sign in.',
      'Open Pantry tab and use mobile card status control.',
      'Verify pantry update feedback appears.',
    ],
    run: runOwnerPantryMobileCardWorkflowCheck,
  },
];

async function main() {
  await mkdir(artifactsDir, { recursive: true });

  const artifactNames = await readdir(artifactsDir);
  await Promise.all(
    artifactNames
      .filter((fileName) => fileName !== 'summary.json')
      .map((fileName) => rm(path.join(artifactsDir, fileName), { force: true })),
  );
  await rm(summaryPath, { force: true });

  const serverOutputChunks = [];
  const server = spawn('npm', ['run', 'dev:e2e'], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
  });

  server.stdout.on('data', (chunk) => {
    serverOutputChunks.push(chunk.toString());
  });
  server.stderr.on('data', (chunk) => {
    serverOutputChunks.push(chunk.toString());
  });

  const getServerOutput = () => serverOutputChunks.join('');
  const startedAt = new Date().toISOString();
  const results = [];

  try {
    await waitForServer(baseUrl, serverStartupTimeoutMs, server, getServerOutput);

    const browser = await puppeteer.launch({
      executablePath: resolveBrowserExecutablePath(),
      headless: parseBooleanEnv(process.env.E2E_HEADLESS, true),
      slowMo: parseNumberEnv(process.env.E2E_SLOW_MO),
      devtools: parseBooleanEnv(process.env.E2E_DEVTOOLS, false),
      defaultViewport: pageViewport,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      for (const scenario of scenarios) {
        const result = await runScenario(browser, scenario);
        results.push(result);
      }
    } finally {
      await browser.close();
    }

    const finishedAt = new Date().toISOString();
    const summary = {
      startedAt,
      finishedAt,
      baseUrl,
      browserExecutablePath: resolveBrowserExecutablePath(),
      overallPass: results.every((result) => result.pass),
      results,
      serverOutput: tailText(getServerOutput(), 12000),
    };

    await writeSummary(summary);

    if (!summary.overallPass) {
      process.exitCode = 1;
    }
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const summary = {
      startedAt,
      finishedAt,
      baseUrl,
      browserExecutablePath: resolveBrowserExecutablePath(),
      overallPass: false,
      results,
      fatalError: formatError(error),
      serverOutput: tailText(getServerOutput(), 12000),
    };

    await writeSummary(summary);
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    await sleep(500);
  }
}

main().catch(async (error) => {
  await mkdir(artifactsDir, { recursive: true });
  await writeSummary({
    overallPass: false,
    fatalError: formatError(error),
  });
  console.error(error);
  process.exitCode = 1;
});
