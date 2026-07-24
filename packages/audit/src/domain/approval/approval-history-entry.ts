import type {
  ApprovalAction
} from "./approval-action.ts";

import type {
  ApprovalActor
} from "./approval-actor.ts";

import type {
  ApprovalStatus
} from "./approval-status.ts";

export interface ApprovalHistoryEntry {
  id: string;
  approvalRequestId: string;

  action: ApprovalAction;

  fromStatus: ApprovalStatus | null;
  toStatus: ApprovalStatus;

  actor: ApprovalActor;

  comment: string | null;
  occurredAt: string;
}

export interface CreateApprovalHistoryEntryInput {
  id?: string;

  action: ApprovalAction;

  fromStatus: ApprovalStatus | null;
  toStatus: ApprovalStatus;

  actor: ApprovalActor;

  comment?: string | null;
  occurredAt?: string;
}
