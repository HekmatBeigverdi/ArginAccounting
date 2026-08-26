import type { ApprovalRequest } from "@argin/audit";

import type { JournalVoucherLifecycleActionCapability } from "./journal-voucher-lifecycle-contracts.ts";
import { JournalVoucherLifecycleApplicationError } from "./journal-voucher-lifecycle-contracts.ts";
import {
  journalVoucherPermissions,
  type JournalVoucherPermission,
} from "./journal-voucher-permissions.ts";

export interface JournalVoucherLifecycleAuthorizer {
  hasPermission(permission: JournalVoucherPermission): Promise<boolean>;
}

export interface JournalVoucherLifecycleAuthorizationEvidenceReader {
  getCurrentApprovalRequest(voucherId: string): Promise<ApprovalRequest | null>;
}

export interface JournalVoucherLifecycleAuthorizationDependencies {
  readonly authorizer: JournalVoucherLifecycleAuthorizer;
  readonly evidence: JournalVoucherLifecycleAuthorizationEvidenceReader;
}

export type JournalVoucherLifecycleAuthorizedAction =
  | "submit"
  | "approve"
  | "reject"
  | "return-to-draft"
  | "cancel-approval"
  | "post"
  | "reopen-for-amendment"
  | "reverse";

export interface JournalVoucherSegregationPolicy {
  readonly prohibitSelfApproval: boolean;
}

export const defaultJournalVoucherSegregationPolicy: JournalVoucherSegregationPolicy =
  Object.freeze({ prohibitSelfApproval: true });

export async function assertJournalVoucherLifecycleAuthorized(input: {
  readonly action: JournalVoucherLifecycleAuthorizedAction;
  readonly voucherId: string;
  readonly actorId: string;
  readonly dependencies: JournalVoucherLifecycleAuthorizationDependencies;
  readonly segregationPolicy?: JournalVoucherSegregationPolicy;
}): Promise<void> {
  const permission = permissionForAction(input.action);
  if (!(await input.dependencies.authorizer.hasPermission(permission))) {
    throw new JournalVoucherLifecycleApplicationError(
      "journal.unauthorized",
      "شما مجوز انجام این عملیات در چرخه عمر سند حسابداری را ندارید.",
      { action: input.action, permission },
    );
  }

  if (input.action !== "approve") return;

  const policy = input.segregationPolicy ?? defaultJournalVoucherSegregationPolicy;
  if (!policy.prohibitSelfApproval) return;

  const approval = await input.dependencies.evidence.getCurrentApprovalRequest(
    input.voucherId,
  );
  if (!approval) return;

  const actorId = input.actorId.trim();
  const requestedById = approval.requestedBy.id?.trim() ?? null;
  if (requestedById && requestedById === actorId) {
    throw new JournalVoucherLifecycleApplicationError(
      "journal.segregation-of-duties-violation",
      "کاربری که سند را برای تأیید ارسال کرده است نمی‌تواند همان چرخه را تأیید کند.",
      {
        action: input.action,
        approvalRequestId: approval.id,
        requestedById,
      },
    );
  }
}

export function permissionForAction(
  action: JournalVoucherLifecycleAuthorizedAction,
): JournalVoucherPermission {
  switch (action) {
    case "submit":
      return journalVoucherPermissions.submit;
    case "approve":
      return journalVoucherPermissions.approve;
    case "reject":
      return journalVoucherPermissions.reject;
    case "return-to-draft":
      return journalVoucherPermissions.returnToDraft;
    case "cancel-approval":
      return journalVoucherPermissions.cancelApproval;
    case "post":
      return journalVoucherPermissions.post;
    case "reopen-for-amendment":
      return journalVoucherPermissions.reopenForAmendment;
    case "reverse":
      return journalVoucherPermissions.reverse;
  }
}

export function permissionForCapability(
  capability: JournalVoucherLifecycleActionCapability,
): JournalVoucherPermission {
  switch (capability) {
    case "edit":
      return journalVoucherPermissions.updateDraft;
    case "delete":
      return journalVoucherPermissions.deleteDraft;
    case "submit_for_approval":
      return journalVoucherPermissions.submit;
    case "approve":
      return journalVoucherPermissions.approve;
    case "reject":
      return journalVoucherPermissions.reject;
    case "return_to_draft":
      return journalVoucherPermissions.returnToDraft;
    case "cancel_approval":
      return journalVoucherPermissions.cancelApproval;
    case "post":
      return journalVoucherPermissions.post;
    case "reopen_for_amendment":
      return journalVoucherPermissions.reopenForAmendment;
    case "reverse":
      return journalVoucherPermissions.reverse;
  }
}
