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
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
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

async function setFirstTextarea(page, placeholder, value) {
  const selector = `textarea[placeholder="${placeholder}"]`;
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (value.length > 0) {
    await page.type(selector, value);
  }
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
      const cards = Array.from(document.querySelectorAll('section div'));
      const card = cards.find((element) => (
        element instanceof HTMLElement
        && normalize(element.textContent ?? '').includes(expectedItemText)
        && Array.from(element.querySelectorAll('button')).some((button) => normalize(button.textContent ?? '') === expectedButtonText)
      ));

      if (!(card instanceof HTMLElement)) {
        return false;
      }

      const button = Array.from(card.querySelectorAll('button')).find((element) => normalize(element.textContent ?? '') === expectedButtonText);
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
        return text === 'Add Note' || text.startsWith('Note:');
      })
    ));

    if (!(card instanceof HTMLElement)) {
      return false;
    }

    const button = Array.from(card.querySelectorAll('button')).find((element) => {
      const text = normalize(element.textContent ?? '');
      return text === 'Add Note' || text.startsWith('Note:');
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

  const noteSelector = 'input[placeholder="Quantity? (e.g. 2kg)"]';
  await page.waitForSelector(noteSelector);
  await fillByPlaceholder(page, 'Quantity? (e.g. 2kg)', noteValue);
  await page.waitForSelector('button[title="Save"]');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const saveButton = buttons.find((element) => element.getAttribute('title') === 'Save');

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
    'Edit the first morning meal entry.',
    'Open Grocery List and mark Tomatoes as bought.',
    'Open Pantry & Logs, add Jeera, then mark it Running Low.',
    'Open Activity Logs and verify the new entry is shown.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=owner`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
  await clickExactText(page, 'button', 'Sign in with Google');
  await waitForText(page, 'Owner View', uiTimeoutMs);
  await waitForText(page, 'Household Settings', uiTimeoutMs);
  await setFirstTextarea(page, 'Plan morning/lunch...', 'E2E Poha and fruit');
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('textarea')).some((element) => element instanceof HTMLTextAreaElement && element.value === 'E2E Poha and fruit'),
    { timeout: uiTimeoutMs },
  );

  await clickExactText(page, 'button', 'Grocery List');
  await waitForText(page, 'Tomatoes', uiTimeoutMs);
  await clickTableRowButton(page, 'Tomatoes', 'Mark Bought');
  await waitForText(page, 'Pantry status updated.', uiTimeoutMs);
  await waitForGroceryItemToDisappear(page, 'Tomatoes', uiTimeoutMs);

  await clickExactText(page, 'button', 'Pantry & Logs');
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
    'Switch to English.',
    'Use Smart Assistant with the standard pantry update prompt.',
    'Search Tomatoes, mark it Full, add a note for Atta, and verify the note is rendered.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
  await clickExactText(page, 'button', 'Sign in with Google');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await clickExactText(page, 'button', 'View in English');
  await waitForText(page, "Today's Menu", uiTimeoutMs);
  await fillByPlaceholder(page, "Tell AI what's finished...", 'Tamatar aur atta khatam ho gaya hai, dhania 2 bunch chahiye');
  await clickExactText(page, 'button', 'Update');
  await waitForText(page, 'Updated successfully!', uiTimeoutMs);
  await waitForText(page, 'Dhania', uiTimeoutMs);
  await waitForText(page, 'On List', uiTimeoutMs);

  await fillByPlaceholder(page, 'Search ingredients...', 'Tomatoes');
  await waitForText(page, 'Tomatoes', uiTimeoutMs);
  await setCookStatus(page, 'Tomatoes', 'Full');
  await waitForText(page, 'Tomatoes ➔ Full', uiTimeoutMs);

  await fillByPlaceholder(page, 'Search ingredients...', 'Atta');
  await waitForText(page, 'Atta', uiTimeoutMs);
  await setCookNote(page, 'Atta', '3kg');
  await waitForText(page, 'Note: 3kg', uiTimeoutMs);

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
    'Switch to English.',
    'Submit the malformed AI marker prompt.',
    'Verify the safe AI error message is rendered and the page stays usable.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
  await clickExactText(page, 'button', 'Sign in with Google');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await clickExactText(page, 'button', 'View in English');
  await waitForText(page, 'Today\'s Menu', uiTimeoutMs);
  await fillByPlaceholder(page, "Tell AI what's finished...", '__e2e_malformed_ai__');
  await clickExactText(page, 'button', 'Update');
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
    'Switch to English.',
    'Submit the unmatched item marker prompt.',
    'Verify the successful update path runs and Milk moves onto the list.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
  await clickExactText(page, 'button', 'Sign in with Google');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await clickExactText(page, 'button', 'View in English');
  await waitForText(page, "Today's Menu", uiTimeoutMs);
  await fillByPlaceholder(page, "Tell AI what's finished...", '__e2e_unmatched_item__');
  await clickExactText(page, 'button', 'Update');
  await waitForText(page, 'Updated successfully!', uiTimeoutMs);
  await fillByPlaceholder(page, 'Search ingredients...', 'Milk');
  await waitForText(page, 'Milk', uiTimeoutMs);
  await waitForText(page, 'On List', uiTimeoutMs);

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
    'Switch to English.',
    'Search for Atta.',
    'Add a note and save it.',
    'Verify the note renders as saved quantity text.',
  ];

  await page.goto(`${baseUrl}/?e2e-role=cook`, { waitUntil: 'domcontentloaded' });
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
  await clickExactText(page, 'button', 'Sign in with Google');
  await waitForText(page, 'Cook View', uiTimeoutMs);
  await clickExactText(page, 'button', 'View in English');
  await waitForText(page, "Today's Menu", uiTimeoutMs);
  await fillByPlaceholder(page, 'Search ingredients...', 'Atta');
  await waitForText(page, 'Atta', uiTimeoutMs);
  await setCookNote(page, 'Atta', '4kg');
  await waitForText(page, 'Note: 4kg', uiTimeoutMs);

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
  await waitForText(page, 'Sign in with Google', uiTimeoutMs);
  await clickExactText(page, 'button', 'Sign in with Google');
  await waitForText(page, 'Owner View', uiTimeoutMs);
  await clickExactText(page, 'button', 'Grocery List');
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
      'Switch to English.',
      'Use Smart Assistant with the standard pantry update prompt.',
      'Search Tomatoes, mark it Full, add a note for Atta, and verify the note is rendered.',
    ],
    run: runCookCoreFlow,
  },
  {
    name: 'ai-malformed-response',
    repro: [
      'Open /?e2e-role=cook.',
      'Click "Sign in with Google".',
      'Switch to English.',
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
      'Switch to English.',
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
      'Switch to English.',
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
      headless: true,
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
