# Rasoi Planner

Rasoi Planner is a shared kitchen workflow app for Indian households.
It helps an **Owner** plan meals and manage pantry inventory, while a **Cook** updates stock status in real time (including AI-assisted pantry updates).

## Who This Is For (ICP)

### Primary product users
- **Household Owner**: plans meals, manages pantry, invites/removes cook access, verifies anomalies.
- **Household Cook**: checks daily menu, marks inventory as low/out/in-stock, adds quantity notes, uses AI assistant.

### Technical stakeholders
- **Contributor**: develops features, fixes bugs, updates rules/tests.
- **QA / Reviewer**: validates role behavior, security rules, and end-to-end journeys.

## What Testers Should Validate

| Role | Must Validate |
| --- | --- |
| Product reviewer | Owner and Cook flows are understandable and usable on local app UI |
| QA / E2E reviewer | `npm run e2e` scenarios pass and `test/e2e/artifacts/summary.json` reports `overallPass: true` |
| Security reviewer | `npm run rules:test` passes Firestore access-control constraints |
| Contributor (before merge) | `npm run verify:local` passes (`lint`, `build`, rules tests, E2E) |

## Stack and Runtime Overview

- Frontend: React 19 + Vite + Tailwind
- Backend endpoint: Vercel serverless function at `POST /api/ai/parse`
- Data/Auth: Firebase Auth (Google) + Firestore
- AI: Gemini model via `@google/genai`
- Tests:
  - Firestore rules tests via Firebase Emulator
  - Browser E2E via Puppeteer + local mocks

## Prerequisites

Install these before local setup:

- Node.js `18+` (LTS recommended)
- npm (comes with Node.js)
- Java `17+` (required by Firestore Emulator used in `rules:test`)
- A Chromium/Chrome browser (for local sign-in popup and E2E)

No global Firebase CLI install is required because `firebase-tools` is in project `devDependencies`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file from example:

```bash
cp .env.example .env.local
```

3. Set `GEMINI_API_KEY` in `.env.local`.

4. Start the app:

```bash
npm run dev
```

App runs at `http://0.0.0.0:3000` (or `http://localhost:3000`).

## Firebase Auth Local Checklist

Before validating sign-in flows, confirm in Firebase Console:

1. **Authentication -> Sign-in method -> Google** is enabled.
2. **Authentication -> Settings -> Authorized domains** includes `localhost` and `127.0.0.1` (if you use that host).
3. Google popup sign-in works in local browser.
4. Owner can invite/remove cook.
5. Invited cook gets access.
6. Removed cook loses access immediately.

## Command Runbook (Exact Scripts)

All scripts below are defined in `package.json`.

- Start dev server:

```bash
npm run dev
```

- Start E2E-focused dev server config:

```bash
npm run dev:e2e
```

- Type-check:

```bash
npm run lint
```

- Production build:

```bash
npm run build
```

- Preview build output:

```bash
npm run preview
```

- Clean build output:

```bash
npm run clean
```

- Firestore rules tests (emulator-backed):

```bash
npm run rules:test
```

- End-to-end tests:

```bash
npm run e2e
```

- Full local verification before release:

```bash
npm run verify:local
```

## Architecture Snapshot

### Core collections
- `households/{householdId}`
- `households/{householdId}/inventory/{itemId}`
- `households/{householdId}/meals/{YYYY-MM-DD}`
- `households/{householdId}/logs/{logId}`

### Owner vs Cook permissions
Owner permissions:
- create/update/delete inventory
- create/update meals
- invite or remove cook (`cookEmail`)
- read all household data

Cook permissions:
- read household, inventory, meals, logs
- update inventory status and request quantities
- cannot modify meals or delete inventory

These constraints are enforced in `firestore.rules` and validated by `test/rules/run.ts`.

## AI Endpoint Contract

### Endpoint
- `POST /api/ai/parse`

### Request body

```json
{
  "input": "tamatar khatam ho gaya",
  "inventory": [{ "id": "9", "name": "Tomatoes", "nameHi": "टमाटर" }],
  "lang": "hi"
}
```

### Success response (shape)

```json
{
  "understood": true,
  "message": "optional",
  "updates": [{ "itemId": "9", "newStatus": "out", "requestedQuantity": "1kg" }],
  "unlistedItems": [{ "name": "Dhania", "status": "low", "category": "Veggies", "requestedQuantity": "2 bunch" }]
}
```

### Failure behavior
- Invalid request body: HTTP `400`
- Missing `GEMINI_API_KEY`: HTTP `503`
- AI/runtime failures: HTTP `500` with safe fallback message
- Client uses safe fallback message if response parsing/validation fails

## Testing and Artifacts

- Firestore rules tests entry: `test/rules/run.ts`
- E2E runner: `test/e2e/run.mjs`
- E2E mock server config: `test/e2e/vite.e2e.config.ts`
- E2E summary output: `test/e2e/artifacts/summary.json`

## Deployment Notes (Vercel + Firebase)

### Vercel
- Ensure rewrites in `vercel.json` are preserved: `/api/*` -> `/api/*` and `/*` -> `/index.html`.
- Set `GEMINI_API_KEY` in Vercel project environment variables.

### Firebase
- Firestore security rules source: `firestore.rules`
- Local emulator config: `firebase.json`
- App uses Firestore named database: `ai-studio-3900af62-0bf5-496a-a136-d1c8a0c4b8bd`
- Confirm production Firebase Auth domain setup before release (Google provider and authorized domains)

### Production Firestore Rules Runbook
1. Mainline path (default):
   - Merge to `main`; CI deploys `firestore.rules` automatically when Firestore files change.
2. CI deploy preconditions:
   - `verify-local` must pass.
   - `npm run rules:target:check` must pass (project/database target integrity gate).
3. Post-deploy smoke checks:
   - Owner smoke user must read `households/{householdId}/unknownIngredientQueue`.
   - Non-member smoke user must receive `PERMISSION_DENIED`.
4. Emergency/manual deploy only:
   - `npm run rules:deploy:prod`
   - `npm run rules:smoke:prod`
5. Optional deploy diagnostics:
   - `npm run rules:deploy:prod:dry`

## GitHub-Vercel Sync Workflow

This project uses GitHub as the deployment source of truth.

### Daily flow
1. Create a feature branch from `main`.
2. Commit and push branch changes.
3. Open a pull request.
4. Wait for CI check `verify-local` to pass.
5. Merge PR into `main`.
6. Vercel auto-deploys merged `main` commit to production.

### CI contract
- Workflow file: `.github/workflows/ci.yml`
- Triggers:
  - every pull request
  - every push to `main`
- Required check name for branch protection: `verify-local`
- CI command chain:
  - `npm ci`
  - `npm run verify:local`
  - `verify-local` includes `npm run rules:target:check`
- `main` push additional automation:
  - Detect Firestore-related file changes.
  - Deploy Firestore rules automatically when changed.
  - Run production smoke test for owner-allow and non-member-deny unknown queue reads.

### Local push gate (Husky)
- Husky install hook is configured via `npm run prepare`.
- Pre-push hook path: `.husky/pre-push`
- Pre-push command: `npm run verify:local`
- If checks fail, push is blocked.

### Required GitHub settings (`main` branch protection)
- Require pull request before merging.
- Require status checks to pass before merging.
- Add required status check: `verify-local`.
- Require branches to be up to date before merging.
- Add repository secrets for Firestore deploy/smoke workflow:
  - `FIREBASE_TOKEN`
  - `SMOKE_OWNER_EMAIL`
  - `SMOKE_OWNER_PASSWORD`
  - `SMOKE_OWNER_HOUSEHOLD_ID`
  - `SMOKE_NON_MEMBER_EMAIL`
  - `SMOKE_NON_MEMBER_PASSWORD`

### Required Vercel settings
- Git repository connected to this GitHub repo.
- Production branch set to `main`.
- Preview deployments enabled for pull requests.
- `GEMINI_API_KEY` configured for Preview and Production environments.

### Emergency rollback
- Open Vercel dashboard.
- Find the last known-good production deployment.
- Redeploy that deployment to production.

## Troubleshooting

### `GEMINI_API_KEY is not configured for the AI parse endpoint`
- Set `GEMINI_API_KEY` in `.env.local` (local) or Vercel environment settings (deploy).

### Firestore rules tests fail with Java/emulator error
- Install Java 17+ and confirm `java -version` resolves correctly in shell.

### `Unknown ingredient queue access denied... [build:<id>]`
- Confirm the visible build id is the latest deployment.
- Validate CI Firestore deploy and smoke test status on latest `main` run.
- For emergency recovery, deploy + smoke manually:
  - `npm run rules:deploy:prod`
  - `npm run rules:smoke:prod`

### Google sign-in popup fails locally
- Add `localhost` / `127.0.0.1` to Firebase Auth authorized domains.
- Ensure browser popup blocking is disabled for local app.

### E2E fails because browser path cannot be resolved
- Install Chrome/Chromium, or set `PUPPETEER_EXECUTABLE_PATH` to a valid browser binary.

### AI updates do not change pantry
- Check browser network call to `/api/ai/parse`.
- Confirm request has `input`, `inventory`, and `lang`.
- Confirm response passes schema validation (`understood`, `updates`, `unlistedItems`).
