import { createMockUser, getSignedInUser, saveSignedInUser, resolveRequestedRole } from './state';

export interface User {
  displayName: string;
  email: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  photoURL: string | null;
  providerData: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    providerId: string;
  }[];
  tenantId: null;
  uid: string;
}

export interface Auth {
  currentUser: User | null;
}

export class GoogleAuthProvider {}

const listeners = new Set<(user: User | null) => void>();
const authInstance: Auth = {
  currentUser: getSignedInUser(),
};

function notifyAuthListeners(): void {
  authInstance.currentUser = getSignedInUser();
  listeners.forEach((listener) => {
    listener(authInstance.currentUser);
  });
}

export function getAuth(_app?: unknown): Auth {
  authInstance.currentUser = getSignedInUser();
  return authInstance;
}

export function onAuthStateChanged(auth: Auth, callback: (user: User | null) => void): () => void {
  listeners.add(callback);
  auth.currentUser = getSignedInUser();
  callback(auth.currentUser);
  return () => {
    listeners.delete(callback);
  };
}

export async function signInWithPopup(auth: Auth, _provider?: GoogleAuthProvider): Promise<{ user: User }> {
  const nextUser = createMockUser(resolveRequestedRole());
  saveSignedInUser(nextUser);
  auth.currentUser = nextUser;
  notifyAuthListeners();
  return { user: nextUser };
}

export async function signInWithRedirect(auth: Auth, _provider?: GoogleAuthProvider): Promise<void> {
  const nextUser = createMockUser(resolveRequestedRole());
  saveSignedInUser(nextUser);
  auth.currentUser = nextUser;
  notifyAuthListeners();
}

export async function signOut(auth: Auth): Promise<void> {
  saveSignedInUser(null);
  auth.currentUser = null;
  notifyAuthListeners();
}
