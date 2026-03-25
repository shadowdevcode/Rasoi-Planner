import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {{
 *   apiKey: string;
 *   projectId: string;
 *   databaseId: string;
 * }} AppFirebaseConfig
 */

/**
 * @typedef {{
 *   email: string;
 *   password: string;
 * }} Credentials
 */

function toNonEmptyString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readAppFirebaseConfig() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = await readFile(configPath, 'utf-8');
  const parsed = JSON.parse(raw);

  return {
    apiKey: String(parsed.apiKey ?? '').trim(),
    databaseId: String(parsed.firestoreDatabaseId ?? '').trim(),
    projectId: String(parsed.projectId ?? '').trim(),
  };
}

function requireEnv(name) {
  const value = toNonEmptyString(process.env[name]);
  if (value === null) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetries(url, init, attempts, delayMs) {
  /** @type {unknown} */
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 && attempt < attempts) {
        console.warn('external_request_retry', {
          attempt,
          reason: 'server_error',
          status: response.status,
          url,
        });
        await sleep(delayMs);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn('external_request_retry', {
          attempt,
          reason: 'network_error',
          url,
        });
        await sleep(delayMs);
        continue;
      }
    }
  }

  throw new Error('External request failed after retries.', { cause: lastError });
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  const bodyText = await response.text();
  if (bodyText.length === 0) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch (error) {
    throw new Error('Failed to parse JSON response body.', {
      cause: error,
    });
  }
}

async function signInWithEmailAndPassword(config, credentials) {
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetchWithRetries(
    signInUrl,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        returnSecureToken: true,
      }),
    },
    3,
    500,
  );

  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error('Failed to authenticate smoke-test user.', {
      cause: {
        request: {
          email: credentials.email,
          endpoint: 'accounts:signInWithPassword',
        },
        response: responseBody,
        status: response.status,
      },
    });
  }

  const idToken = toNonEmptyString(responseBody?.idToken);
  const localId = toNonEmptyString(responseBody?.localId);

  if (idToken === null || localId === null) {
    throw new Error('Smoke-test authentication response is missing required token fields.', {
      cause: {
        request: {
          email: credentials.email,
          endpoint: 'accounts:signInWithPassword',
        },
        response: responseBody,
        status: response.status,
      },
    });
  }

  return {
    idToken,
    localId,
  };
}

async function readUnknownIngredientQueue(config, householdId, idToken) {
  const encodedHouseholdId = encodeURIComponent(householdId);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(config.databaseId)}/documents/households/${encodedHouseholdId}/unknownIngredientQueue?pageSize=1`;

  const response = await fetchWithRetries(
    endpoint,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${idToken}`,
      },
    },
    3,
    500,
  );

  const responseBody = await parseJsonResponse(response);

  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  };
}

function isPermissionDeniedFirestoreResponse(readResult) {
  if (!readResult || typeof readResult !== 'object') {
    return false;
  }

  const body = readResult.body;
  const code = body?.error?.status;
  const message = body?.error?.message;

  return readResult.status === 403 && code === 'PERMISSION_DENIED' && typeof message === 'string';
}

async function assertOwnerCanReadQueue(config, householdId, ownerCredentials) {
  const ownerAuth = await signInWithEmailAndPassword(config, ownerCredentials);
  const readResult = await readUnknownIngredientQueue(config, householdId, ownerAuth.idToken);

  if (!readResult.ok) {
    throw new Error('Owner smoke check failed: unknown queue read was denied.', {
      cause: {
        actor: 'owner',
        householdId,
        readResult,
      },
    });
  }

  console.info('smoke_check_owner_access_ok', {
    actor: ownerCredentials.email,
    householdId,
    status: readResult.status,
  });
}

async function assertNonMemberIsDenied(config, householdId, nonMemberCredentials) {
  const nonMemberAuth = await signInWithEmailAndPassword(config, nonMemberCredentials);
  const readResult = await readUnknownIngredientQueue(config, householdId, nonMemberAuth.idToken);

  if (!isPermissionDeniedFirestoreResponse(readResult)) {
    throw new Error('Non-member smoke check failed: expected PERMISSION_DENIED.', {
      cause: {
        actor: 'non-member',
        householdId,
        readResult,
      },
    });
  }

  console.info('smoke_check_non_member_denied_ok', {
    actor: nonMemberCredentials.email,
    householdId,
    status: readResult.status,
    firestoreStatus: readResult.body?.error?.status,
  });
}

function getCredentialsFromEnv(prefix) {
  const email = requireEnv(`${prefix}_EMAIL`);
  const password = requireEnv(`${prefix}_PASSWORD`);

  return {
    email,
    password,
  };
}

async function main() {
  const configFromFile = await readAppFirebaseConfig();
  const config = {
    apiKey: toNonEmptyString(process.env.SMOKE_FIREBASE_API_KEY) ?? configFromFile.apiKey,
    projectId: toNonEmptyString(process.env.SMOKE_FIREBASE_PROJECT_ID) ?? configFromFile.projectId,
    databaseId: toNonEmptyString(process.env.SMOKE_FIREBASE_DATABASE_ID) ?? configFromFile.databaseId,
  };

  if (!config.apiKey || !config.projectId || !config.databaseId) {
    throw new Error('Missing Firebase runtime config required for smoke checks.', {
      cause: {
        apiKeyConfigured: Boolean(config.apiKey),
        projectIdConfigured: Boolean(config.projectId),
        databaseIdConfigured: Boolean(config.databaseId),
      },
    });
  }

  const householdId = requireEnv('SMOKE_OWNER_HOUSEHOLD_ID');
  const ownerCredentials = getCredentialsFromEnv('SMOKE_OWNER');
  const nonMemberCredentials = getCredentialsFromEnv('SMOKE_NON_MEMBER');

  console.info('smoke_check_started', {
    databaseId: config.databaseId,
    projectId: config.projectId,
  });

  await assertOwnerCanReadQueue(config, householdId, ownerCredentials);
  await assertNonMemberIsDenied(config, householdId, nonMemberCredentials);

  console.info('smoke_check_completed', {
    databaseId: config.databaseId,
    projectId: config.projectId,
  });
}

main().catch((error) => {
  console.error('smoke_check_failed', {
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : null,
  });
  process.exitCode = 1;
});
