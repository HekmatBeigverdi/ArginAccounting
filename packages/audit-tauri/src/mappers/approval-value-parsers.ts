import {
  isApprovalAction,
  isApprovalStatus
} from "@argin/audit";

import type {
  ApprovalAction,
  ApprovalActorType,
  ApprovalStatus
} from "@argin/audit";

const approvalActorTypes:
  readonly ApprovalActorType[] = [
    "user",
    "system"
  ];

export function parseApprovalStatus(
  value: string
): ApprovalStatus {
  if (!isApprovalStatus(value)) {
    throw new Error(
      `Invalid approval status: ${value}`
    );
  }

  return value;
}

export function parseNullableApprovalStatus(
  value: string | null
): ApprovalStatus | null {
  if (value === null) {
    return null;
  }

  return parseApprovalStatus(value);
}

export function parseApprovalAction(
  value: string
): ApprovalAction {
  if (!isApprovalAction(value)) {
    throw new Error(
      `Invalid approval action: ${value}`
    );
  }

  return value;
}

export function parseApprovalActorType(
  value: string
): ApprovalActorType {
  if (
    !approvalActorTypes.includes(
      value as ApprovalActorType
    )
  ) {
    throw new Error(
      `Invalid approval actor type: ${value}`
    );
  }

  return value as ApprovalActorType;
}
