import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  commitSalesPostingJournalAtomic,
  createSalesPosting,
  createSalesPostingJournalDraft,
} from "../src/index.ts";

const source = {
  sourceSystem: "sales",
  sourceType: "sales-invoice",
  sourceDocumentId: "invoice-001",
  sourceVersion: 4,
  externalReference: null,
} as const;

const components = [
  {
    componentId: "commercial:accounts-receivable",
    role: "accounts-receivable",
    side: "debit",
    accountId: "ar",
    amount: 110,
    currency: "IRR",
    salesLineId: null,
    customerPartyId: "customer-001",
    productId: null,
    inventoryDocumentId: null,
    inventoryLineId: null,
    movementId: null,
    valuationEntryId: null,
    valuationMethod: null,
    valuationRevision: null,
    originalInvoiceId: null,
    originalInvoiceLineId: null,
    taxIds: [],
    taxCodes: [],
  },
  {
    componentId: "commercial:revenue:line-1",
    role: "sales-revenue",
    side: "credit",
    accountId: "revenue",
    amount: 100,
    currency: "IRR",
    salesLineId: "line-1",
    customerPartyId: null,
    productId: null,
    inventoryDocumentId: null,
    inventoryLineId: null,
    movementId: null,
    valuationEntryId: null,
    valuationMethod: null,
    valuationRevision: null,
    originalInvoiceId: null,
    originalInvoiceLineId: null,
    taxIds: [],
    taxCodes: [],
  },
  {
    componentId: "commercial:output-vat:line-1",
    role: "output-vat",
    side: "credit",
    accountId: "vat",
    amount: 10,
    currency: "IRR",
    salesLineId: "line-1",
    customerPartyId: null,
    productId: null,
    inventoryDocumentId: null,
    inventoryLineId: null,
    movementId: null,
    valuationEntryId: null,
    valuationMethod: null,
    valuationRevision: null,
    originalInvoiceId: null,
    originalInvoiceLineId: null,
    taxIds: ["vat-1"],
    taxCodes: ["VAT"],
  },
] as const;

function journalInput() {
  return {
    journalVoucherId: "journal-001",
    journalNumber: "JV-001",
    postingId: "posting-001",
    source,
    companyId: "company-001",
    branchId: "branch-001",
    voucherDate: "2026-10-07",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-07",
    createdAtUtc: "2026-10-07T14:30:00.000Z",
    components,
    requestId: "request-001",
    causationId: null,
  } as const;
}

test("creates balanced Accounting Journal draft with source-owned metadata", () => {
  const result = createSalesPostingJournalDraft(journalInput());

  assert.equal(result.journal.status, "draft");
  assert.equal(result.journal.source.type, "source_document");
  assert.equal(result.journal.source.sourceId, "invoice-001");
  assert.equal(result.journal.source.correlationId, "posting-001");
  assert.equal(result.journal.totalDebit.amount, 110);
  assert.equal(result.journal.totalCredit.amount, 110);
  assert.equal(result.journal.lines.length, 3);
});

test("creates readable Persian line descriptions instead of hash-only text", () => {
  const result = createSalesPostingJournalDraft(journalInput());

  assert.match(result.journal.lines[0]!.description ?? "", /حساب دریافتنی فروش/u);
  assert.match(result.journal.lines[1]!.description ?? "", /درآمد فروش/u);
  assert.match(result.journal.lines[2]!.description ?? "", /مالیات بر ارزش افزوده فروش/u);
});

test("preserves one immutable provenance row for every Journal line", () => {
  const result = createSalesPostingJournalDraft(journalInput());

  assert.equal(result.provenance.journalVoucherId, "journal-001");
  assert.equal(result.provenance.postingId, "posting-001");
  assert.equal(result.provenance.source.sourceDocumentId, "invoice-001");
  assert.equal(result.provenance.source.sourceVersion, 4);
  assert.equal(result.provenance.lineProvenance.length, result.journal.lines.length);
  assert.equal(result.provenance.lineProvenance[1]?.salesLineId, "line-1");
  assert.deepEqual(result.provenance.lineProvenance[2]?.taxIds, ["vat-1"]);
});

test("rejects unbalanced Journal component set", () => {
  assert.throws(
    () => createSalesPostingJournalDraft({
      ...journalInput(),
      components: components.slice(0, 2),
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.journalBalanceMismatch,
  );
});

test("valuation provenance requires movement, product, method and revision", () => {
  assert.throws(
    () => createSalesPostingJournalDraft({
      ...journalInput(),
      components: [
        {
          ...components[0],
          componentId: "cost:cogs:line-1",
          role: "cogs",
          amount: 50,
          productId: "p1",
          movementId: null,
          valuationEntryId: "val-1",
          valuationMethod: "fifo",
          valuationRevision: 2,
        },
        {
          ...components[1],
          componentId: "cost:inventory:line-1",
          role: "inventory-asset",
          side: "credit",
          amount: 50,
          productId: "p1",
          movementId: "mov-1",
          valuationEntryId: "val-1",
          valuationMethod: "fifo",
          valuationRevision: 2,
        },
      ] as any,
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
  );
});

test("atomically persists Journal, provenance, Posting CAS, idempotency and Outbox", async () => {
  let posting = createSalesPosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source,
    createdAtUtc: "2026-10-07T14:00:00.000Z",
  });
  let journal:any = null;
  let provenance:any = null;
  let idempotency:any = null;
  const outbox:any[] = [];

  const result = await commitSalesPostingJournalAtomic({
    ...journalInput(),
    purpose: "accounting-recognition",
    payloadFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    expectedPostingVersion: 1,
    outboxEventId: "outbox-001",
  }, {
    async run(work) {
      return work({
        async findIdempotencyRecord() { return idempotency; },
        async findPosting(id) { return id === posting.postingId ? posting : null; },
        async findJournalVoucher(id) { return journal?.id === id ? journal : null; },
        async findJournalProvenance(id) { return provenance?.journalVoucherId === id ? provenance : null; },
        async createJournalDraft(value) { journal = value; },
        async savePostingCas(value, expectedVersion) {
          if (posting.version !== expectedVersion) return false;
          posting = value;
          return true;
        },
        async saveIdempotencyRecord(value) { idempotency = value; },
        async saveJournalProvenance(value) { provenance = value; },
        async appendOutboxEvent(value) { outbox.push(value); },
      });
    },
  });

  assert.equal(result.replayed, false);
  assert.equal(posting.version, 2);
  assert.equal(journal.id, "journal-001");
  assert.equal(provenance.journalVoucherId, "journal-001");
  assert.equal(idempotency.journalVoucherId, "journal-001");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].journalVoucherId, "journal-001");
});

test("compatible atomic replay returns existing Journal without duplicate writes", async () => {
  const storedPosting = createSalesPosting({
    postingId: "posting-001",
    companyId: "company-001",
    branchId: "branch-001",
    source,
    createdAtUtc: "2026-10-07T14:00:00.000Z",
  });
  const draft = createSalesPostingJournalDraft(journalInput());
  const record:any = {
    idempotencyKey: "sales:sales-invoice:invoice-001:v4:purpose:accounting-recognition",
    source,
    purpose: "accounting-recognition",
    payloadFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    postingId: "posting-001",
    journalVoucherId: "journal-001",
    committedPostingVersion: 1,
    committedAtUtc: "2026-10-07T14:30:00.000Z",
  };
  let writes = 0;

  const result = await commitSalesPostingJournalAtomic({
    ...journalInput(),
    purpose: "accounting-recognition",
    payloadFingerprint: record.payloadFingerprint,
    expectedPostingVersion: 1,
    outboxEventId: "outbox-002",
  }, {
    async run(work) {
      return work({
        async findIdempotencyRecord() { return record; },
        async findPosting() { return storedPosting; },
        async findJournalVoucher() { return draft.journal; },
        async findJournalProvenance() { return draft.provenance; },
        async createJournalDraft() { writes += 1; },
        async savePostingCas() { writes += 1; return true; },
        async saveIdempotencyRecord() { writes += 1; },
        async saveJournalProvenance() { writes += 1; },
        async appendOutboxEvent() { writes += 1; },
      });
    },
  });

  assert.equal(result.replayed, true);
  assert.equal(result.journal.id, "journal-001");
  assert.equal(writes, 0);
});
