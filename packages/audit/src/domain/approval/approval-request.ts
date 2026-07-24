import type {
  ApprovalActor
} from "./approval-actor";

import type {
  ApprovalHistoryEntry
} from "./approval-history-entry";

import type {
  ApprovalScope
} from "./approval-scope";

import type {
  ApprovalStatus
} from "./approval-status";

import type {
  ApprovalTarget
} from "./approval-target";

export const initialApprovalRequestVersion = 1;

export interface ApprovalRequest {
  id: string;

  version: number;

  requestType: string;
  title: string;
  description: string | null;

  status: ApprovalStatus;

  target: ApprovalTarget;
  scope: ApprovalScope;

  requestedBy: ApprovalActor;
  requestedAt: string | null;

  decidedBy: ApprovalActor | null;
  decidedAt: string | null;

  decisionComment: string | null;

  createdAt: string;
  updatedAt: string;

  history: ApprovalHistoryEntry[];
}

export interface CreateApprovalRequestInput {
  id?: string;

  requestType: string;
  title: string;
  description?: string | null;

  target: ApprovalTarget;
  scope?: Partial<ApprovalScope>;

  createdBy: ApprovalActor;
  createdAt?: string;
}
