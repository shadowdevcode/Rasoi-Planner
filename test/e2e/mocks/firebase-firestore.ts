import { deleteDocument, getDatabase, getDocument, listCollectionDocuments, nextGeneratedId, setDocument, updateDocument } from './state';

export interface Firestore {
  __brand: 'mock-firestore';
  databaseId?: string;
}

export interface CollectionReference {
  kind: 'collection';
  path: string;
}

export interface DocumentReference {
  id: string;
  kind: 'document';
  path: string;
}

interface WhereConstraint {
  field: string;
  kind: 'where';
  operator: '==';
  value: unknown;
}

interface OrderByConstraint {
  direction: 'asc' | 'desc';
  field: string;
  kind: 'orderBy';
}

type QueryConstraint = WhereConstraint | OrderByConstraint;

export interface Query {
  constraints: QueryConstraint[];
  kind: 'query';
  path: string;
}

export type Unsubscribe = () => void;

interface QueryDocumentSnapshot {
  data: () => Record<string, unknown>;
  id: string;
}

interface QuerySnapshot {
  docs: QueryDocumentSnapshot[];
  empty: boolean;
  forEach: (callback: (snapshot: QueryDocumentSnapshot) => void) => void;
}

interface DocumentSnapshot {
  data: () => Record<string, unknown> | undefined;
  exists: () => boolean;
  id: string;
}

interface Transaction {
  get: (reference: DocumentReference) => Promise<DocumentSnapshot>;
  set: (reference: DocumentReference, value: Record<string, unknown>) => void;
}

type SnapshotTarget = CollectionReference | DocumentReference | Query;
type Listener = {
  error?: (error: unknown) => void;
  next: (snapshot: QuerySnapshot | DocumentSnapshot) => void;
  target: SnapshotTarget;
};

const firestoreInstance: Firestore = {
  __brand: 'mock-firestore',
};
const listeners = new Set<Listener>();

function createQueryDocumentSnapshot(path: string, data: Record<string, unknown>): QueryDocumentSnapshot {
  return {
    id: path.split('/').at(-1) ?? '',
    data: () => structuredClone(data),
  };
}

function createDocumentSnapshot(target: DocumentReference): DocumentSnapshot {
  const data = getDocument(target.path);
  return {
    id: target.id,
    exists: () => data !== null,
    data: () => (data ? structuredClone(data) : undefined),
  };
}

function applyConstraints(entries: { path: string; data: Record<string, unknown> }[], constraints: QueryConstraint[]): { path: string; data: Record<string, unknown> }[] {
  return constraints.reduce((currentEntries, constraint) => {
    if (constraint.kind === 'where') {
      return currentEntries.filter(({ data }) => data[constraint.field] === constraint.value);
    }

    return [...currentEntries].sort((left, right) => {
      const leftValue = left.data[constraint.field];
      const rightValue = right.data[constraint.field];
      const normalizedLeft = typeof leftValue === 'string' ? leftValue : JSON.stringify(leftValue);
      const normalizedRight = typeof rightValue === 'string' ? rightValue : JSON.stringify(rightValue);
      const comparison = normalizedLeft.localeCompare(normalizedRight);
      return constraint.direction === 'desc' ? comparison * -1 : comparison;
    });
  }, entries);
}

function createQuerySnapshot(target: CollectionReference | Query): QuerySnapshot {
  const entries = listCollectionDocuments(target.path).map(({ path, data }) => ({ path, data }));
  const filteredEntries = target.kind === 'query' ? applyConstraints(entries, target.constraints) : entries;
  const docs = filteredEntries.map(({ path, data }) => createQueryDocumentSnapshot(path, data));
  return {
    docs,
    empty: docs.length === 0,
    forEach: (callback) => {
      docs.forEach(callback);
    },
  };
}

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      if (listener.target.kind === 'document') {
        listener.next(createDocumentSnapshot(listener.target));
        return;
      }
      listener.next(createQuerySnapshot(listener.target));
    } catch (error) {
      listener.error?.(error);
    }
  });
}

function normalizeDocPath(basePath: string, childPath?: string): string {
  if (!childPath) {
    return basePath;
  }
  return `${basePath}/${childPath}`;
}

export function getFirestore(_app: unknown, databaseId?: string): Firestore {
  firestoreInstance.databaseId = databaseId;
  void getDatabase();
  return firestoreInstance;
}

export function collection(_input: Firestore | DocumentReference, path: string): CollectionReference {
  return {
    kind: 'collection',
    path,
  };
}

export function doc(input: Firestore | CollectionReference, path?: string, childPath?: string): DocumentReference {
  if ((input as CollectionReference).kind === 'collection') {
    const collectionReference = input as CollectionReference;
    const id = path ?? nextGeneratedId();
    return {
      kind: 'document',
      id,
      path: normalizeDocPath(collectionReference.path, id),
    };
  }

  if (!path) {
    throw new Error('Document path is required.');
  }

  const fullPath = childPath ? `${path}/${childPath}` : path;
  return {
    kind: 'document',
    id: fullPath.split('/').at(-1) ?? '',
    path: fullPath,
  };
}

export function where(field: string, operator: '==', value: unknown): WhereConstraint {
  return {
    kind: 'where',
    field,
    operator,
    value,
  };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return {
    kind: 'orderBy',
    field,
    direction,
  };
}

export function query(collectionReference: CollectionReference, ...constraints: QueryConstraint[]): Query {
  return {
    kind: 'query',
    path: collectionReference.path,
    constraints,
  };
}

export async function getDocs(target: CollectionReference | Query): Promise<QuerySnapshot> {
  return createQuerySnapshot(target);
}

export async function getDoc(reference: DocumentReference): Promise<DocumentSnapshot> {
  return createDocumentSnapshot(reference);
}

export async function setDoc(reference: DocumentReference, value: Record<string, unknown>): Promise<void> {
  setDocument(reference.path, structuredClone(value));
  notifyListeners();
}

export async function updateDoc(reference: DocumentReference, patch: Record<string, unknown>): Promise<void> {
  updateDocument(reference.path, structuredClone(patch));
  notifyListeners();
}

export async function deleteDoc(reference: DocumentReference): Promise<void> {
  deleteDocument(reference.path);
  notifyListeners();
}

export function writeBatch(_db: Firestore): {
  commit: () => Promise<void>;
  set: (reference: DocumentReference, value: Record<string, unknown>) => void;
  update: (reference: DocumentReference, value: Record<string, unknown>) => void;
} {
  const operations: (() => void)[] = [];
  return {
    set: (reference, value) => {
      operations.push(() => {
        setDocument(reference.path, structuredClone(value));
      });
    },
    update: (reference, value) => {
      operations.push(() => {
        updateDocument(reference.path, structuredClone(value));
      });
    },
    commit: async () => {
      operations.forEach((operation) => operation());
      notifyListeners();
    },
  };
}

export async function runTransaction<T>(db: Firestore, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
  void db;
  const stagedSets: Array<{ reference: DocumentReference; value: Record<string, unknown> }> = [];
  const transaction: Transaction = {
    get: async (reference) => createDocumentSnapshot(reference),
    set: (reference, value) => {
      stagedSets.push({
        reference,
        value: structuredClone(value),
      });
    },
  };

  const result = await operation(transaction);
  stagedSets.forEach((entry) => {
    setDocument(entry.reference.path, entry.value);
  });
  if (stagedSets.length > 0) {
    notifyListeners();
  }
  return result;
}

export function onSnapshot(
  target: SnapshotTarget,
  next: (snapshot: QuerySnapshot | DocumentSnapshot) => void,
  error?: (error: unknown) => void,
): Unsubscribe {
  const listener: Listener = {
    target,
    next,
    error,
  };
  listeners.add(listener);
  try {
    if (target.kind === 'document') {
      next(createDocumentSnapshot(target));
    } else {
      next(createQuerySnapshot(target));
    }
  } catch (snapshotError) {
    error?.(snapshotError);
  }
  return () => {
    listeners.delete(listener);
  };
}
