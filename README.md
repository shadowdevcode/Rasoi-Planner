<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3900af62-0bf5-496a-a136-d1c8a0c4b8bd

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Local End-to-End Check Before Vercel

Run the full local verification flow (type-check + production build + Firestore rules tests on emulator + end-to-end tests):

`npm run verify:local`

Firestore rules tests require Java (17 or newer) because the Firestore Emulator runs on Java.

You can run Firestore rules tests independently:

`npm run rules:test`

The E2E summary is written to:

`test/e2e/artifacts/summary.json`

## Localhost Firebase Auth Checklist

Before final deploy validation, confirm these in Firebase Console:

1. Authentication → Sign-in method → Google provider is enabled.
2. Authentication → Settings → Authorized domains contains `localhost`.
3. If you use `127.0.0.1` locally, add `127.0.0.1` to Authorized domains as well.
4. Run `npm run dev` and confirm Google popup sign-in works.
5. Validate role permissions:
   - Owner can invite/remove cook.
   - Invited cook gets access.
   - Removed cook loses access immediately.
