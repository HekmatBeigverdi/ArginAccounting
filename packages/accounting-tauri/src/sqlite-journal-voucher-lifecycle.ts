import type {
  JournalVoucher,
  JournalVoucherApprovalCycle,
  JournalVoucherApprovalGateway,
  JournalVoucherApprovalSession,
  JournalVoucherApprovalUnitOfWork,
  JournalVoucherAmendmentEvidence,
  JournalVoucherAmendmentSession,
  JournalVoucherAmendmentUnitOfWork,
  JournalVoucherLifecycleReader,
  JournalVoucherPostingEvidence,
  JournalVoucherPostingSession,
  JournalVoucherPostingUnitOfWork,
  JournalVoucherReversalLineage,
  JournalVoucherReversalRecord,
  JournalVoucherReversalSession,
  JournalVoucherReversalUnitOfWork,
} from "@argin/accounting/journal";
import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import { SqliteJournalVoucherRepository } from "./repositories/sqlite-journal-voucher-repository.ts";

interface ApprovalCycleRow {
  approval_request_id: string;
  voucher_id: string;
  submitted_content_version: number;
  is_current: number;
}

interface PostingEvidenceRow {
  voucher_id: string;
  approval_request_id: string;
  submitted_content_version: number;
  posted_version: number;
  posted_by: string;
  posted_at: string;
  posting_reference: string | null;
}

interface AmendmentEvidenceRow {
  voucher_id: string;
  approval_request_id: string;
  previous_version: number;
  reopened_version: number;
  reopened_by: string;
  reopened_at: string;
  reason: string;
}

interface ReversalLineageRow {
  original_voucher_id: string;
  reversal_voucher_id: string;
  replacement_voucher_id: string | null;
  request_id: string;
  reversed_by: string;
  reversed_at: string;
  reason: string;
}

export type JournalVoucherApprovalGatewayFactory =
  (session: DatabaseSession) => JournalVoucherApprovalGateway;

export type JournalVoucherApprovalRequestReaderFactory =
  (session: DatabaseSession) => Pick<JournalVoucherPostingSession, "getApprovalRequest">;

class SqliteJournalVoucherLifecycleStore {
  readonly journals: SqliteJournalVoucherRepository;

  constructor(private readonly session: DatabaseSession) {
    this.journals = new SqliteJournalVoucherRepository(session);
  }

  getVoucher(voucherId: string): Promise<JournalVoucher | null> {
    return this.journals.findById(voucherId);
  }

  saveVoucher(voucher: JournalVoucher, expectedVersion: number): Promise<void> {
    return this.journals.updateLifecycleState(voucher, expectedVersion);
  }

  async getCurrentApprovalCycle(voucherId: string): Promise<JournalVoucherApprovalCycle | null> {
    const row = await this.session.queryOne<ApprovalCycleRow>(
      `SELECT approval_request_id, voucher_id, submitted_content_version, is_current
       FROM journal_voucher_approval_cycles
       WHERE voucher_id = ? AND is_current = 1
       LIMIT 1`,
      [voucherId],
    );
    return row ? mapApprovalCycle(row) : null;
  }

  async saveApprovalCycle(cycle: JournalVoucherApprovalCycle): Promise<void> {
    await this.session.execute(
      `INSERT INTO journal_voucher_approval_cycles (
        approval_request_id, voucher_id, company_id,
        submitted_content_version, is_current, created_at, closed_at
      ) VALUES (
        ?, ?,
        (SELECT company_id FROM journal_vouchers WHERE id = ?),
        ?, ?,
        (SELECT updated_at FROM journal_vouchers WHERE id = ?),
        NULL
      )
      ON CONFLICT(approval_request_id) DO UPDATE SET
        submitted_content_version = excluded.submitted_content_version,
        is_current = excluded.is_current,
        closed_at = CASE WHEN excluded.is_current = 1 THEN NULL ELSE journal_voucher_approval_cycles.closed_at END`,
      [
        cycle.approvalRequestId,
        cycle.voucherId,
        cycle.voucherId,
        cycle.submittedContentVersion,
        cycle.isCurrent ? 1 : 0,
        cycle.voucherId,
      ],
    );
  }

  async closeApprovalCycle(approvalRequestId: string): Promise<void> {
    await this.session.execute(
      `UPDATE journal_voucher_approval_cycles
       SET is_current = 0,
           closed_at = COALESCE(closed_at, (SELECT updated_at FROM journal_vouchers
             WHERE id = journal_voucher_approval_cycles.voucher_id))
       WHERE approval_request_id = ? AND is_current = 1`,
      [approvalRequestId],
    );
  }

  async savePostingEvidence(evidence: JournalVoucherPostingEvidence): Promise<void> {
    await this.session.execute(
      `INSERT INTO journal_voucher_posting_evidence (
        voucher_id, company_id, approval_request_id, submitted_content_version,
        posted_version, posted_by, posted_at, posting_reference
      ) SELECT ?, company_id, ?, ?, ?, ?, ?, ?
        FROM journal_vouchers WHERE id = ?`,
      [
        evidence.voucherId,
        evidence.approvalRequestId,
        evidence.submittedContentVersion,
        evidence.postedVersion,
        evidence.postedBy,
        evidence.postedAt,
        evidence.postingReference,
        evidence.voucherId,
      ],
    );
  }

  async saveAmendmentEvidence(evidence: JournalVoucherAmendmentEvidence): Promise<void> {
    await this.session.execute(
      `INSERT INTO journal_voucher_amendment_evidence (
        voucher_id, company_id, approval_request_id, previous_version,
        reopened_version, reopened_by, reopened_at, reason
      ) SELECT ?, company_id, ?, ?, ?, ?, ?, ?
        FROM journal_vouchers WHERE id = ?`,
      [
        evidence.voucherId,
        evidence.approvalRequestId,
        evidence.previousVersion,
        evidence.reopenedVersion,
        evidence.reopenedBy,
        evidence.reopenedAt,
        evidence.reason,
        evidence.voucherId,
      ],
    );
  }

  async findPostingEvidence(voucherId: string): Promise<JournalVoucherPostingEvidence | null> {
    const row = await this.session.queryOne<PostingEvidenceRow>(
      `SELECT voucher_id, approval_request_id, submitted_content_version,
              posted_version, posted_by, posted_at, posting_reference
       FROM journal_voucher_posting_evidence WHERE voucher_id = ?`,
      [voucherId],
    );
    return row ? mapPostingEvidence(row) : null;
  }

  async findLatestAmendmentEvidence(voucherId: string): Promise<JournalVoucherAmendmentEvidence | null> {
    const row = await this.session.queryOne<AmendmentEvidenceRow>(
      `SELECT voucher_id, approval_request_id, previous_version, reopened_version,
              reopened_by, reopened_at, reason
       FROM journal_voucher_amendment_evidence
       WHERE voucher_id = ? ORDER BY reopened_version DESC LIMIT 1`,
      [voucherId],
    );
    return row ? mapAmendmentEvidence(row) : null;
  }

  async getReversalLineageByOriginalVoucherId(originalVoucherId: string): Promise<JournalVoucherReversalLineage | null> {
    const row = await this.session.queryOne<ReversalLineageRow>(
      `SELECT original_voucher_id, reversal_voucher_id, replacement_voucher_id,
              request_id, reversed_by, reversed_at, reason
       FROM journal_voucher_reversal_lineage WHERE original_voucher_id = ?`,
      [originalVoucherId],
    );
    return row ? mapReversalLineage(row) : null;
  }

  async findReversalLineage(voucherId: string): Promise<JournalVoucherReversalLineage | null> {
    const row = await this.session.queryOne<ReversalLineageRow>(
      `SELECT original_voucher_id, reversal_voucher_id, replacement_voucher_id,
              request_id, reversed_by, reversed_at, reason
       FROM journal_voucher_reversal_lineage
       WHERE original_voucher_id = ? OR reversal_voucher_id = ? OR replacement_voucher_id = ?
       ORDER BY CASE WHEN original_voucher_id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [voucherId, voucherId, voucherId, voucherId],
    );
    return row ? mapReversalLineage(row) : null;
  }

  async getReversalByRequestId(companyId: string, requestId: string): Promise<JournalVoucherReversalRecord | null> {
    const row = await this.session.queryOne<ReversalLineageRow>(
      `SELECT original_voucher_id, reversal_voucher_id, replacement_voucher_id,
              request_id, reversed_by, reversed_at, reason
       FROM journal_voucher_reversal_lineage
       WHERE company_id = ? AND request_id = ? LIMIT 1`,
      [companyId, requestId],
    );
    if (!row) return null;
    const lineage = mapReversalLineage(row);
    const [originalVoucher, reversalVoucher] = await Promise.all([
      this.journals.findById(lineage.originalVoucherId),
      this.journals.findById(lineage.reversalVoucherId),
    ]);
    if (!originalVoucher || !reversalVoucher) {
      throw new Error(`Corrupt journal reversal lineage for request ${requestId}`);
    }
    return Object.freeze({ originalVoucher, reversalVoucher, lineage });
  }

  async saveReversal(input: {
    readonly originalVoucher: JournalVoucher;
    readonly expectedOriginalVersion: number;
    readonly reversalVoucher: JournalVoucher;
    readonly lineage: JournalVoucherReversalLineage;
  }): Promise<void> {
    await this.journals.updateLifecycleState(input.originalVoucher, input.expectedOriginalVersion);
    await this.journals.create(input.reversalVoucher);
    await this.session.execute(
      `INSERT INTO journal_voucher_reversal_lineage (
        original_voucher_id, reversal_voucher_id, replacement_voucher_id,
        company_id, request_id, reversed_by, reversed_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.lineage.originalVoucherId,
        input.lineage.reversalVoucherId,
        input.lineage.replacementVoucherId,
        input.originalVoucher.companyId,
        input.lineage.requestId,
        input.lineage.reversedBy,
        input.lineage.reversedAt,
        input.lineage.reason,
      ],
    );
  }
}

export class SqliteJournalVoucherApprovalUnitOfWork implements JournalVoucherApprovalUnitOfWork {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly approvalGatewayFactory: JournalVoucherApprovalGatewayFactory,
  ) {}

  run<T>(work: (session: JournalVoucherApprovalSession) => Promise<T>): Promise<T> {
    return this.database.transaction(async (session) => {
      const store = new SqliteJournalVoucherLifecycleStore(session);
      return work({
        getVoucher: (id) => store.getVoucher(id),
        saveVoucher: (voucher, expectedVersion) => store.saveVoucher(voucher, expectedVersion),
        getCurrentApprovalCycle: (id) => store.getCurrentApprovalCycle(id),
        saveApprovalCycle: (cycle) => store.saveApprovalCycle(cycle),
        closeApprovalCycle: (id) => store.closeApprovalCycle(id),
        approval: this.approvalGatewayFactory(session),
      });
    });
  }
}

export class SqliteJournalVoucherPostingUnitOfWork implements JournalVoucherPostingUnitOfWork {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly approvalReaderFactory: JournalVoucherApprovalRequestReaderFactory,
  ) {}

  run<T>(work: (session: JournalVoucherPostingSession) => Promise<T>): Promise<T> {
    return this.database.transaction(async (session) => {
      const store = new SqliteJournalVoucherLifecycleStore(session);
      const approvals = this.approvalReaderFactory(session);
      return work({
        getVoucher: (id) => store.getVoucher(id),
        getCurrentApprovalCycle: (id) => store.getCurrentApprovalCycle(id),
        getApprovalRequest: (id) => approvals.getApprovalRequest(id),
        savePostedVoucher: async (voucher, expectedVersion, evidence) => {
          await store.saveVoucher(voucher, expectedVersion);
          await store.savePostingEvidence(evidence);
        },
      });
    });
  }
}

export class SqliteJournalVoucherAmendmentUnitOfWork implements JournalVoucherAmendmentUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  run<T>(work: (session: JournalVoucherAmendmentSession) => Promise<T>): Promise<T> {
    return this.database.transaction(async (session) => {
      const store = new SqliteJournalVoucherLifecycleStore(session);
      return work({
        getVoucher: (id) => store.getVoucher(id),
        saveVoucher: (voucher, expectedVersion) => store.saveVoucher(voucher, expectedVersion),
        getCurrentApprovalCycle: (id) => store.getCurrentApprovalCycle(id),
        closeApprovalCycle: (id) => store.closeApprovalCycle(id),
        saveAmendmentEvidence: (evidence) => store.saveAmendmentEvidence(evidence),
      });
    });
  }
}

export class SqliteJournalVoucherReversalUnitOfWork implements JournalVoucherReversalUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  run<T>(work: (session: JournalVoucherReversalSession) => Promise<T>): Promise<T> {
    return this.database.transaction(async (session) => {
      const store = new SqliteJournalVoucherLifecycleStore(session);
      return work({
        getVoucher: (id) => store.getVoucher(id),
        getReversalByRequestId: (companyId, requestId) => store.getReversalByRequestId(companyId, requestId),
        getReversalLineageByOriginalVoucherId: (id) => store.getReversalLineageByOriginalVoucherId(id),
        saveReversal: (input) => store.saveReversal(input),
      });
    });
  }
}

export class SqliteJournalVoucherLifecycleReader implements JournalVoucherLifecycleReader {
  private readonly store: SqliteJournalVoucherLifecycleStore;

  constructor(session: DatabaseSession) {
    this.store = new SqliteJournalVoucherLifecycleStore(session);
  }

  findVoucher(voucherId: string) { return this.store.getVoucher(voucherId); }
  findCurrentApprovalCycle(voucherId: string) { return this.store.getCurrentApprovalCycle(voucherId); }
  findPostingEvidence(voucherId: string) { return this.store.findPostingEvidence(voucherId); }
  findLatestAmendmentEvidence(voucherId: string) { return this.store.findLatestAmendmentEvidence(voucherId); }
  findReversalLineage(voucherId: string) { return this.store.findReversalLineage(voucherId); }
}

function mapApprovalCycle(row: ApprovalCycleRow): JournalVoucherApprovalCycle {
  return Object.freeze({
    approvalRequestId: row.approval_request_id,
    voucherId: row.voucher_id,
    submittedContentVersion: row.submitted_content_version,
    isCurrent: row.is_current === 1,
  });
}

function mapPostingEvidence(row: PostingEvidenceRow): JournalVoucherPostingEvidence {
  return Object.freeze({
    voucherId: row.voucher_id,
    approvalRequestId: row.approval_request_id,
    submittedContentVersion: row.submitted_content_version,
    postedVersion: row.posted_version,
    postedBy: row.posted_by,
    postedAt: row.posted_at,
    postingReference: row.posting_reference,
  });
}

function mapAmendmentEvidence(row: AmendmentEvidenceRow): JournalVoucherAmendmentEvidence {
  return Object.freeze({
    voucherId: row.voucher_id,
    approvalRequestId: row.approval_request_id,
    previousVersion: row.previous_version,
    reopenedVersion: row.reopened_version,
    reopenedBy: row.reopened_by,
    reopenedAt: row.reopened_at,
    reason: row.reason,
  });
}

function mapReversalLineage(row: ReversalLineageRow): JournalVoucherReversalLineage {
  return Object.freeze({
    originalVoucherId: row.original_voucher_id,
    reversalVoucherId: row.reversal_voucher_id,
    replacementVoucherId: row.replacement_voucher_id,
    requestId: row.request_id,
    reversedBy: row.reversed_by,
    reversedAt: row.reversed_at,
    reason: row.reason,
  });
}
