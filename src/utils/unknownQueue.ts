import { UnknownIngredientQueueItem } from '../types';

export interface FirestoreListenerErrorInfo {
  code: string | null;
  message: string | null;
  name: string | null;
}

export interface UnknownQueueTargetFingerprintInput {
  databaseId: string;
  householdId: string;
  projectId: string;
}

export interface HouseholdMembershipProbeInput {
  householdCookEmail: string | null;
  householdExists: boolean;
  householdOwnerId: string | null;
  userEmail: string | null;
  userUid: string;
}

export type HouseholdMembershipProbeResult = 'owner' | 'cook' | 'non-member' | 'household-missing';

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toTimestampMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function toFirestoreListenerErrorInfo(error: unknown): FirestoreListenerErrorInfo {
  const record = toRecord(error);
  return {
    code: toOptionalString(record?.code),
    message: toOptionalString(record?.message),
    name: toOptionalString(record?.name),
  };
}

export function isFirestoreFailedPreconditionError(error: FirestoreListenerErrorInfo): boolean {
  return error.code === 'failed-precondition';
}

export function isFirestorePermissionDeniedError(error: FirestoreListenerErrorInfo): boolean {
  return error.code === 'permission-denied';
}

function normalizeEmail(value: string | null): string {
  return value === null ? '' : value.trim().toLowerCase();
}

export function classifyHouseholdMembershipProbe(input: HouseholdMembershipProbeInput): HouseholdMembershipProbeResult {
  if (!input.householdExists) {
    return 'household-missing';
  }

  if (input.householdOwnerId === input.userUid) {
    return 'owner';
  }

  const normalizedCookEmail = normalizeEmail(input.householdCookEmail);
  const normalizedUserEmail = normalizeEmail(input.userEmail);
  if (normalizedCookEmail.length > 0 && normalizedCookEmail === normalizedUserEmail) {
    return 'cook';
  }

  return 'non-member';
}

export function buildUnknownQueueTargetFingerprint(input: UnknownQueueTargetFingerprintInput): string {
  return `${input.projectId}/${input.databaseId}/households/${input.householdId}/unknownIngredientQueue`;
}

export function getUnknownQueueLoadErrorMessage(
  error: FirestoreListenerErrorInfo,
  membershipProbeResult: HouseholdMembershipProbeResult | null,
): string {
  if (isFirestorePermissionDeniedError(error)) {
    if (membershipProbeResult === 'non-member' || membershipProbeResult === 'household-missing') {
      return 'Unknown ingredient queue access denied. Household membership mismatch suspected.';
    }
    return 'Unknown ingredient queue access denied. Firestore target mismatch suspected. Verify project/database rules deployment.';
  }

  if (isFirestoreFailedPreconditionError(error)) {
    return 'Unknown ingredient queue index is missing. Showing fallback order while index is provisioned.';
  }

  return 'Failed to load unknown ingredient queue.';
}

export function sortUnknownIngredientQueueItemsByCreatedAt(items: UnknownIngredientQueueItem[]): UnknownIngredientQueueItem[] {
  return [...items].sort((leftItem, rightItem) => {
    const rightTime = toTimestampMs(rightItem.createdAt);
    const leftTime = toTimestampMs(leftItem.createdAt);

    if (rightTime !== null && leftTime !== null) {
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
    } else if (rightTime !== null && leftTime === null) {
      return 1;
    } else if (rightTime === null && leftTime !== null) {
      return -1;
    }

    if (rightItem.createdAt !== leftItem.createdAt) {
      return rightItem.createdAt.localeCompare(leftItem.createdAt);
    }

    return rightItem.id.localeCompare(leftItem.id);
  });
}
