import type { DatabaseSession } from "@argin/database";
import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  createPurchasePostingIdempotencyRecord,
  createPurchasePostingRule,
  rehydratePurchasePosting,
  type PurchasePostingAggregate,
  type PurchasePostingIdempotencyRecord,
  type PurchasePostingReversalRecord,
  type PurchasePostingRule,
} from "@argin/purchase-posting";

type PostingRow = {
  posting_id: string;
  company_id: string;
  branch_id: string;
  status: PurchasePostingAggregate["status"];
  journal_voucher_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type RuleRow = {
  rule_id: string;
  company_id: string;
  branch_id: string | null;
  event_kind: PurchasePostingRule["eventKind"];
  line_kind: PurchasePostingRule["lineKind"];
  account_role: PurchasePostingRule["accountRole"];
  account_id: string;
  priority: number;
  active: number;
};

type IdempotencyRow = {
  idempotency_key: string;
  company_id: string;
  branch_id: string;
  source_system: "purchase";
  source_type: PurchasePostingIdempotencyRecord["source"]["sourceType"];
  source_id: string;
  source_version: number;
  source_revision: number | null;
  posting_purpose: PurchasePostingIdempotencyRecord["purpose"];
  payload_fingerprint: string;
  posting_id: string;
  journal_voucher_id: string;
  committed_posting_version: number;
  committed_at: string;
};

type ReversalRow = {
  posting_id: string;
  company_id: string;
  original_journal_voucher_id: string;
  reversal_journal_voucher_id: string;
  request_id: string;
  reversed_by: string;
  reversed_at: string;
  reason: string;
  committed_posting_version: number;
};

const domainError = (
  code: keyof typeof PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  field: string,
): never => {
  throw new PurchasePostingDomainError(PURCHASE_POSTING_DOMAIN_ERROR_CODES[code], field);
};

const mapPosting = (row: PostingRow): PurchasePostingAggregate =>
  rehydratePurchasePosting({
    postingId: row.posting_id,
    companyId: row.company_id,
    branchId: row.branch_id,
    status: row.status,
    journalVoucherId: row.journal_voucher_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export class SqlitePurchasePostingRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findById(postingId: string): Promise<PurchasePostingAggregate | null> {
    const row = await this.db.queryOne<PostingRow>(
      "SELECT posting_id,company_id,branch_id,status,journal_voucher_id,version,created_at,updated_at FROM purchase_postings WHERE posting_id=?",
      [postingId],
    );
    return row ? mapPosting(row) : null;
  }

  async add(posting: PurchasePostingAggregate): Promise<void> {
    await this.db.execute(
      `INSERT INTO purchase_postings
       (posting_id,company_id,branch_id,status,journal_voucher_id,version,created_at,updated_at,sync_origin,sync_changed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        posting.postingId, posting.companyId, posting.branchId, posting.status,
        posting.journalVoucherId, posting.version, posting.createdAt, posting.updatedAt,
        "local", posting.updatedAt,
      ],
    );
  }

  async update(posting: PurchasePostingAggregate, expectedVersion: number): Promise<void> {
    const result = await this.db.execute(
      `UPDATE purchase_postings
          SET status=?,journal_voucher_id=?,version=?,updated_at=?,sync_changed_at=?
        WHERE posting_id=? AND company_id=? AND version=?`,
      [
        posting.status, posting.journalVoucherId, posting.version, posting.updatedAt, posting.updatedAt,
        posting.postingId, posting.companyId, expectedVersion,
      ],
    );
    if (result.rowsAffected !== 1) {
      return domainError("concurrencyConflict", "expectedPostingVersion");
    }
  }
}

export interface PersistedPurchasePostingRule {
  readonly rule: PurchasePostingRule;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class SqlitePurchasePostingRuleRepository {
  constructor(private readonly db: DatabaseSession) {}

  async listActive(companyId: string): Promise<readonly PurchasePostingRule[]> {
    const rows = await this.db.query<RuleRow>(
      `SELECT rule_id,company_id,branch_id,event_kind,line_kind,account_role,account_id,priority,active
         FROM purchase_posting_rules
        WHERE company_id=? AND active=1
        ORDER BY account_role,priority DESC,rule_id`,
      [companyId],
    );
    return Object.freeze(rows.map(row => createPurchasePostingRule({
      ruleId: row.rule_id,
      companyId: row.company_id,
      branchId: row.branch_id,
      eventKind: row.event_kind,
      lineKind: row.line_kind,
      accountRole: row.account_role,
      accountId: row.account_id,
      priority: row.priority,
      active: row.active === 1,
    })));
  }

  async add(input: PersistedPurchasePostingRule): Promise<void> {
    const { rule } = input;
    await this.db.execute(
      `INSERT INTO purchase_posting_rules
       (rule_id,company_id,branch_id,event_kind,line_kind,account_role,account_id,priority,active,version,created_at,updated_at,sync_origin,sync_changed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        rule.ruleId, rule.companyId, rule.branchId, rule.eventKind, rule.lineKind,
        rule.accountRole, rule.accountId, rule.priority, rule.active ? 1 : 0,
        input.version, input.createdAt, input.updatedAt, "local", input.updatedAt,
      ],
    );
  }

  async update(input: PersistedPurchasePostingRule, expectedVersion: number): Promise<void> {
    const { rule } = input;
    const result = await this.db.execute(
      `UPDATE purchase_posting_rules SET
         branch_id=?,event_kind=?,line_kind=?,account_role=?,account_id=?,priority=?,active=?,version=?,updated_at=?,sync_changed_at=?
       WHERE company_id=? AND rule_id=? AND version=?`,
      [
        rule.branchId, rule.eventKind, rule.lineKind, rule.accountRole, rule.accountId,
        rule.priority, rule.active ? 1 : 0, input.version, input.updatedAt, input.updatedAt,
        rule.companyId, rule.ruleId, expectedVersion,
      ],
    );
    if (result.rowsAffected !== 1) {
      return domainError("concurrencyConflict", "postingRule.version");
    }
  }
}

const mapIdempotency = (row: IdempotencyRow): PurchasePostingIdempotencyRecord =>
  createPurchasePostingIdempotencyRecord({
    idempotencyKey: row.idempotency_key,
    source: {
      companyId: row.company_id,
      branchId: row.branch_id,
      sourceSystem: row.source_system,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceVersion: row.source_version,
      sourceRevision: row.source_revision,
    },
    purpose: row.posting_purpose,
    payloadFingerprint: row.payload_fingerprint,
    postingId: row.posting_id,
    journalVoucherId: row.journal_voucher_id,
    committedPostingVersion: row.committed_posting_version,
    committedAt: row.committed_at,
  });

export class SqlitePurchasePostingIdempotencyRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findByKey(idempotencyKey: string): Promise<PurchasePostingIdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRow>(
      "SELECT * FROM purchase_posting_idempotency WHERE idempotency_key=?",
      [idempotencyKey],
    );
    return row ? mapIdempotency(row) : null;
  }

  async add(record: PurchasePostingIdempotencyRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO purchase_posting_idempotency
       (idempotency_key,company_id,branch_id,source_system,source_type,source_id,source_version,source_revision,
        posting_purpose,payload_fingerprint,posting_id,journal_voucher_id,committed_posting_version,committed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        record.idempotencyKey, record.source.companyId, record.source.branchId,
        record.source.sourceSystem, record.source.sourceType, record.source.sourceId,
        record.source.sourceVersion, record.source.sourceRevision, record.purpose,
        record.payloadFingerprint, record.postingId, record.journalVoucherId,
        record.committedPostingVersion, record.committedAt,
      ],
    );
  }
}

const mapReversal = (row: ReversalRow): PurchasePostingReversalRecord => Object.freeze({
  postingId: row.posting_id,
  originalJournalVoucherId: row.original_journal_voucher_id,
  reversalJournalVoucherId: row.reversal_journal_voucher_id,
  requestId: row.request_id,
  reversedBy: row.reversed_by,
  reversedAt: row.reversed_at,
  reason: row.reason,
  committedPostingVersion: row.committed_posting_version,
});

export class SqlitePurchasePostingReversalRepository {
  constructor(private readonly db: DatabaseSession) {}

  async findByRequestId(companyId: string, requestId: string): Promise<PurchasePostingReversalRecord | null> {
    const row = await this.db.queryOne<ReversalRow>(
      "SELECT * FROM purchase_posting_reversals WHERE company_id=? AND request_id=?",
      [companyId, requestId],
    );
    return row ? mapReversal(row) : null;
  }

  async add(companyId: string, record: PurchasePostingReversalRecord): Promise<void> {
    await this.db.execute(
      `INSERT INTO purchase_posting_reversals
       (posting_id,company_id,original_journal_voucher_id,reversal_journal_voucher_id,request_id,reversed_by,reversed_at,reason,committed_posting_version)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        record.postingId, companyId, record.originalJournalVoucherId,
        record.reversalJournalVoucherId, record.requestId, record.reversedBy,
        record.reversedAt, record.reason, record.committedPostingVersion,
      ],
    );
  }
}
