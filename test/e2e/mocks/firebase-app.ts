export interface FirebaseApp {
  options: Record<string, unknown>;
}

export function initializeApp(options: Record<string, unknown>): FirebaseApp {
  return { options };
}
