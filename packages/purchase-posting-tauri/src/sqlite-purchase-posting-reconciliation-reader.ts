import type { DatabaseSession } from "@argin/database";
import { SqliteJournalVoucherRepository } from "@argin/accounting-tauri";
import {
  createPurchasePostingSourceIdentity,
  evaluatePurchasePostingReconciliation,
  type PurchasePostingReconciliationReader,
  type PurchasePostingReconciliationSnapshot,
  type PurchasePostingSourceIdentity,
} from "@argin/purchase-posting";
import {
  SqlitePurchasePostingRepository,
  SqlitePurchasePostingReversalRepository,
} from "./sqlite-purchase-posting-repositories.ts";

type SourceRow = {
  company_id: string;
  branch_id: string;
  source_system: "purchase";
  source_type: PurchasePostingSourceIdentity["sourceType"];
  source_id: string;
  source_version: number;
  source_revision: number | null;
  posting_id: string;
  journal_voucher_id: string;
};

type LineOwnerRow = {
  voucher_id: string;
};

export class SqlitePurchasePostingReconciliationReader
implements PurchasePostingReconciliationReader {
  constructor(private readonly db: DatabaseSession) {}

  async findBySource(
    companyId: string,
    sourceType: PurchasePostingSourceIdentity["sourceType"],
    sourceId: string,
  ): Promise<readonly PurchasePostingReconciliationSnapshot[]> {
    const rows = await this.db.query<SourceRow>(
      `SELECT company_id,branch_id,source_system,source_type,source_id,
              source_version,source_revision,posting_id,journal_voucher_id
         FROM purchase_posting_idempotency
        WHERE company_id=? AND source_type=? AND source_id=?
        ORDER BY source_version,COALESCE(source_revision,-1),committed_at,posting_id`,
      [companyId, sourceType, sourceId],
    );
    const result: PurchasePostingReconciliationSnapshot[] = [];
    for (const row of rows) {
      const snapshot = await this.hydrate(row);
      if (snapshot) result.push(snapshot);
    }
    return Object.freeze(result);
  }

  async findByPostingId(
    companyId: string,
    postingId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null> {
    const row = await this.db.queryOne<SourceRow>(
      `SELECT company_id,branch_id,source_system,source_type,source_id,
              source_version,source_revision,posting_id,journal_voucher_id
         FROM purchase_posting_idempotency
        WHERE company_id=? AND posting_id=?
        ORDER BY committed_at DESC
        LIMIT 1`,
      [companyId, postingId],
    );
    return row ? this.hydrate(row) : null;
  }

  async findByJournalVoucherId(
    companyId: string,
    journalVoucherId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null> {
    const row = await this.db.queryOne<SourceRow>(
      `SELECT company_id,branch_id,source_system,source_type,source_id,
              source_version,source_revision,posting_id,journal_voucher_id
         FROM purchase_posting_idempotency
        WHERE company_id=? AND journal_voucher_id=?
        ORDER BY committed_at DESC
        LIMIT 1`,
      [companyId, journalVoucherId],
    );
    if (row) return this.hydrate(row);

    const reversal = await this.db.queryOne<{ posting_id: string }>(
      `SELECT posting_id
         FROM purchase_posting_reversals
        WHERE company_id=? AND reversal_journal_voucher_id=?`,
      [companyId, journalVoucherId],
    );
    return reversal
      ? this.findByPostingId(companyId, reversal.posting_id)
      : null;
  }

  async findByJournalLineId(
    companyId: string,
    journalLineId: string,
  ): Promise<PurchasePostingReconciliationSnapshot | null> {
    const row = await this.db.queryOne<LineOwnerRow>(
      `SELECT l.voucher_id
         FROM journal_lines l
         JOIN journal_vouchers v ON v.id=l.voucher_id
        WHERE v.company_id=? AND l.id=?`,
      [companyId, journalLineId],
    );
    return row
      ? this.findByJournalVoucherId(companyId, row.voucher_id)
      : null;
  }

  private async hydrate(
    row: SourceRow,
  ): Promise<PurchasePostingReconciliationSnapshot | null> {
    const source = createPurchasePostingSourceIdentity({
      companyId: row.company_id,
      branchId: row.branch_id,
      sourceSystem: row.source_system,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceVersion: row.source_version,
      sourceRevision: row.source_revision,
    });

    const postings = new SqlitePurchasePostingRepository(this.db);
    const reversals = new SqlitePurchasePostingReversalRepository(this.db);
    const journals = new SqliteJournalVoucherRepository(this.db);

    const posting = await postings.findById(row.posting_id);
    const journal = await journals.findById(row.journal_voucher_id);
    if (posting === null || journal === null) return null;

    const reversal = await this.db.queryOne<{
      request_id: string;
      original_journal_voucher_id: string;
      reversal_journal_voucher_id: string;
      reversed_by: string;
      reversed_at: string;
      reason: string;
      committed_posting_version: number;
    }>(
      `SELECT request_id,original_journal_voucher_id,reversal_journal_voucher_id,
              reversed_by,reversed_at,reason,committed_posting_version
         FROM purchase_posting_reversals
        WHERE company_id=? AND posting_id=?`,
      [row.company_id, row.posting_id],
    );

    const reversalRecord = reversal
      ? Object.freeze({
          postingId: row.posting_id,
          originalJournalVoucherId: reversal.original_journal_voucher_id,
          reversalJournalVoucherId: reversal.reversal_journal_voucher_id,
          requestId: reversal.request_id,
          reversedBy: reversal.reversed_by,
          reversedAt: reversal.reversed_at,
          reason: reversal.reason,
          committedPostingVersion: reversal.committed_posting_version,
        })
      : null;

    const reversalJournal = reversalRecord
      ? await journals.findById(reversalRecord.reversalJournalVoucherId)
      : null;

    const issues = evaluatePurchasePostingReconciliation({
      source,
      posting,
      journal,
      reversal: reversalRecord,
      reversalJournal,
    });

    return Object.freeze({
      companyId: row.company_id,
      source,
      posting,
      journal,
      reversal: reversalRecord,
      reversalJournal,
      issues,
      reconciled: issues.length === 0,
    });
  }
}
