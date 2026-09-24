import type { JournalVoucher } from "@argin/accounting/journal";
import type { PurchasePostingAggregate } from "../../domain/purchase-posting.ts";
import type { PurchasePostingSourceIdentity } from "../../domain/purchase-posting-source-reference.ts";
import type { PurchasePostingReversalRecord } from "../controlled-posting-reversal.ts";

export const PURCHASE_POSTING_RECONCILIATION_ISSUES = Object.freeze([
  "posting-missing",
  "journal-missing",
  "source-mismatch",
  "company-mismatch",
  "branch-mismatch",
  "journal-unbalanced",
  "posting-state-mismatch",
  "reversal-lineage-missing",
  "reversal-journal-missing",
  "reversal-journal-invalid",
] as const);

export type PurchasePostingReconciliationIssue =
  (typeof PURCHASE_POSTING_RECONCILIATION_ISSUES)[number];

export interface PurchasePostingReconciliationSnapshot {
  readonly companyId: string;
  readonly source: Readonly<PurchasePostingSourceIdentity>;
  readonly posting: Readonly<PurchasePostingAggregate> | null;
  readonly journal: Readonly<JournalVoucher> | null;
  readonly reversal: Readonly<PurchasePostingReversalRecord> | null;
  readonly reversalJournal: Readonly<JournalVoucher> | null;
  readonly issues: readonly PurchasePostingReconciliationIssue[];
  readonly reconciled: boolean;
}

export interface PurchasePostingReconciliationReader {
  findBySource(
    companyId: string,
    sourceType: PurchasePostingSourceIdentity["sourceType"],
    sourceId: string,
  ): Promise<readonly PurchasePostingReconciliationSnapshot[]>;

  findByPostingId(
    companyId: string,
    postingId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null>;

  findByJournalVoucherId(
    companyId: string,
    journalVoucherId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null>;

  findByJournalLineId(
    companyId: string,
    journalLineId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null>;
}

export function evaluatePurchasePostingReconciliation(input: {
  readonly source: PurchasePostingSourceIdentity;
  readonly posting: PurchasePostingAggregate | null;
  readonly journal: JournalVoucher | null;
  readonly reversal: PurchasePostingReversalRecord | null;
  readonly reversalJournal: JournalVoucher | null;
}): readonly PurchasePostingReconciliationIssue[] {
  const issues: PurchasePostingReconciliationIssue[] = [];
  const { source, posting, journal, reversal, reversalJournal } = input;

  if (posting === null) issues.push("posting-missing");
  if (journal === null) issues.push("journal-missing");
  if (posting === null || journal === null) return Object.freeze([...new Set(issues)]);

  if (posting.companyId !== source.companyId || journal.companyId !== source.companyId) {
    issues.push("company-mismatch");
  }
  if (posting.branchId !== source.branchId || journal.branchId !== source.branchId) {
    issues.push("branch-mismatch");
  }
  if (
    journal.source.type !== "source_document"
    || journal.source.sourceId !== source.sourceId
  ) {
    issues.push("source-mismatch");
  }
  if (
    journal.totalDebit.currency !== journal.totalCredit.currency
    || journal.totalDebit.amount !== journal.totalCredit.amount
  ) {
    issues.push("journal-unbalanced");
  }

  if (
    (posting.status === "draft" && posting.journalVoucherId !== null)
    || (posting.status !== "draft" && posting.journalVoucherId !== journal.id)
    || (posting.status === "prepared" && journal.status !== "draft")
    || (posting.status === "posted" && journal.status !== "posted")
    || (posting.status === "reversed" && journal.status !== "reversed")
  ) {
    issues.push("posting-state-mismatch");
  }

  if (posting.status === "reversed") {
    if (reversal === null) {
      issues.push("reversal-lineage-missing");
    } else {
      if (reversal.originalJournalVoucherId !== journal.id) {
        issues.push("reversal-journal-invalid");
      }
      if (reversalJournal === null) {
        issues.push("reversal-journal-missing");
      } else if (
        reversalJournal.id !== reversal.reversalJournalVoucherId
        || reversalJournal.companyId !== posting.companyId
        || reversalJournal.status !== "posted"
        || reversalJournal.totalDebit.amount !== reversalJournal.totalCredit.amount
      ) {
        issues.push("reversal-journal-invalid");
      }
    }
  }

  return Object.freeze([...new Set(issues)]);
}
