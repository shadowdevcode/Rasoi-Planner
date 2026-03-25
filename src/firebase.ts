import { initializeApp } from 'firebase/app';
import { AuthError, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const REDIRECT_ELIGIBLE_POPUP_ERROR_CODES: ReadonlySet<string> = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

function isAuthError(error: unknown): error is AuthError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as Partial<AuthError>;
  return typeof candidate.code === 'string';
}

function shouldFallbackToRedirect(error: AuthError): boolean {
  return REDIRECT_ELIGIBLE_POPUP_ERROR_CODES.has(error.code);
}

export const loginWithGoogle = async (): Promise<void> => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (isAuthError(error) && shouldFallbackToRedirect(error)) {
      // COOP/preview-related popup constraints can be non-fatal; redirect login remains valid.
      console.warn('google_login_popup_failed_redirect_fallback', {
        code: error.code,
        message: error.message,
      });
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    if (isAuthError(error)) {
      console.error('google_login_failed', {
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    console.error('google_login_failed_unknown_error', { error });
    throw error;
  }
};

export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
