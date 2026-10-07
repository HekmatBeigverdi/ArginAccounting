import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  SecuredSalesPostingService,
  assertDeterministicRecoveryTransition,
  createSalesPosting,
  projectSalesPostingRecovery,
  salesPostingAuditIdentity,
  salesPostingPermissions,
} from "../src/index.ts";

const source = {
  sourceSystem: "sales",
  sourceType: "sales-invoice",
  sourceDocumentId: "invoice-001",
  sourceVersion: 4,
  externalReference: null,
} as const;

const posting = createSalesPosting({
  postingId: "posting-001",
  companyId: "company-001",
  branchId: "branch-001",
  source,
  createdAtUtc: "2026-10-07T14:00:00.000Z",
});

const trace = {
  requestId: "request-001",
  operationId: "operation-001",
  correlationId: "correlation-001",
  causationId: null,
} as const;

test("projects deterministic waiting, ready, blocked and committed recovery states", () => {
  const pending = projectSalesPostingRecovery({
    orchestration: {
      status: "pending",
      path: "stock-only",
      sourceDocumentId: "invoice-001",
      companyId: "company-001",
      reason: "waiting-for-valuation",
      waitingLineIds: ["line-1"],
    },
  });
  assert.equal(pending.status, "pending");
  assert.equal(pending.retryAction, "wait");

  const retry = projectSalesPostingRecovery({
    orchestration: {
      status: "ready",
      path: "service-only",
      sourceDocumentId: "invoice-001",
      companyId: "company-001",
      commercial: {} as any,
      cost: null,
    },
    lastErrorCode: SALES_POSTING_DOMAIN_ERROR_CODES.concurrencyConflict,
  });
  assert.equal(retry.status, "ready");
  assert.equal(retry.retryAction, "retry");

  const blocked = projectSalesPostingRecovery({
    orchestration: {
      status: "ready",
      path: "service-only",
      sourceDocumentId: "invoice-001",
      companyId: "company-001",
      commercial: {} as any,
      cost: null,
    },
    lastErrorCode: SALES_POSTING_DOMAIN_ERROR_CODES.accountMappingMissing,
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.retryAction, "manual-review");

  const committed = projectSalesPostingRecovery({
    orchestration: {
      status: "ready",
      path: "service-only",
      sourceDocumentId: "invoice-001",
      companyId: "company-001",
      commercial: {} as any,
      cost: null,
    },
    committed: {
      idempotencyKey: "k",
      source,
      purpose: "accounting-recognition",
      payloadFingerprint: "a".repeat(64),
      postingId: "posting-001",
      journalVoucherId: "journal-001",
      committedPostingVersion: 2,
      committedAtUtc: "2026-10-07T14:30:00.000Z",
    },
  });
  assert.equal(committed.status, "committed");
  assert.equal(committed.retryAction, "replay");
  assert.equal(committed.journalVoucherId, "journal-001");
});

test("committed recovery cannot regress or point to another Journal", () => {
  const committed = {
    status: "committed",
    retryAction: "replay",
    reason: null,
    waitingLineIds: [],
    journalVoucherId: "journal-001",
    committedPostingVersion: 2,
  } as const;

  assert.throws(
    () => assertDeterministicRecoveryTransition(committed, {
      ...committed,
      status: "ready",
      retryAction: "retry",
      journalVoucherId: null,
      committedPostingVersion: null,
    }),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.recoveryConflict,
  );
});

function service(options?: {
  deny?: string;
  traceSnapshot?: any;
}) {
  const audits:any[] = [];
  const requiredPermissions:string[] = [];

  return {
    audits,
    requiredPermissions,
    service: new SecuredSalesPostingService({
      postings: {
        async findById(id) { return id === posting.postingId ? posting : null; },
      },
      authorization: {
        async require(_context, permission) {
          requiredPermissions.push(permission);
          if (options?.deny === permission) throw new Error("denied");
        },
      },
      audit: {
        async record(event) { audits.push(event); },
      },
      traceReader: {
        async findByPostingId() { return options?.traceSnapshot ?? null; },
      },
      journalUnitOfWork: {
        async run() { throw new Error("journal UoW should not run in these tests"); },
      },
    }),
  };
}

test("recovery requires dedicated recover permission and records audit trace", async () => {
  const fixture = service();
  const recovery = await fixture.service.recover(
    { actorId: "actor-001" },
    {
      companyId: "company-001",
      branchId: "branch-001",
      postingId: "posting-001",
      orchestration: {
        status: "pending",
        path: "stock-only",
        sourceDocumentId: "invoice-001",
        companyId: "company-001",
        reason: "waiting-for-movement",
        waitingLineIds: ["line-1"],
      },
      trace,
      occurredAtUtc: "2026-10-07T14:40:00.000Z",
    },
  );

  assert.equal(recovery.retryAction, "wait");
  assert.deepEqual(fixture.requiredPermissions, [salesPostingPermissions.recover]);
  assert.equal(fixture.audits.length, 1);
  assert.equal(fixture.audits[0].action, "sales-posting.recover");
  assert.equal(fixture.audits[0].requestId, "request-001");
  assert.equal(fixture.audits[0].operationId, "operation-001");
});

test("unauthorized recovery fails before action", async () => {
  const fixture = service({ deny: salesPostingPermissions.recover });

  await assert.rejects(
    () => fixture.service.recover(
      { actorId: "actor-001" },
      {
        companyId: "company-001",
        branchId: "branch-001",
        postingId: "posting-001",
        orchestration: {
          status: "pending",
          path: "stock-only",
          sourceDocumentId: "invoice-001",
          companyId: "company-001",
          reason: "waiting-for-issue",
          waitingLineIds: ["line-1"],
        },
        trace,
        occurredAtUtc: "2026-10-07T14:40:00.000Z",
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.unauthorized,
  );
  assert.equal(fixture.audits.length, 0);
});

test("trace view requires dedicated permission and is itself audited", async () => {
  const recovery = {
    status: "pending",
    retryAction: "wait",
    reason: "waiting-for-valuation",
    waitingLineIds: ["line-1"],
    journalVoucherId: null,
    committedPostingVersion: null,
  } as const;
  const snapshot = {
    companyId: "company-001",
    branchId: "branch-001",
    postingId: "posting-001",
    postingVersion: 1,
    source,
    journalVoucherId: null,
    ...trace,
    recovery,
  };
  const fixture = service({ traceSnapshot: snapshot });

  const result = await fixture.service.viewTrace(
    { actorId: "actor-001" },
    {
      companyId: "company-001",
      branchId: "branch-001",
      postingId: "posting-001",
      trace,
      occurredAtUtc: "2026-10-07T14:45:00.000Z",
    },
  );

  assert.equal(result?.postingId, "posting-001");
  assert.deepEqual(fixture.requiredPermissions, [salesPostingPermissions.viewTrace]);
  assert.equal(fixture.audits[0].action, "sales-posting.trace.view");
});

test("deterministic audit identity uses action operation and posting", () => {
  const id = salesPostingAuditIdentity({
    action: "sales-posting.recover",
    actorId: "actor-001",
    companyId: "company-001",
    branchId: "branch-001",
    postingId: "posting-001",
    journalVoucherId: null,
    requestId: "request-001",
    operationId: "operation-001",
    correlationId: "correlation-001",
    causationId: null,
    occurredAtUtc: "2026-10-07T14:45:00.000Z",
    source,
    beforeVersion: 1,
    afterVersion: 1,
    approval: null,
    recovery: null,
    metadata: {},
  });
  assert.equal(
    id,
    "sales-posting:sales-posting.recover:operation-001:posting-001",
  );
});

test("execute requiring approval rejects missing approval evidence before Journal mutation", async () => {
  const fixture = service();

  await assert.rejects(
    () => fixture.service.execute(
      { actorId: "actor-001" },
      {
        command: {
          journalVoucherId: "journal-001",
          journalNumber: "JV-1",
          postingId: "posting-001",
          source,
          companyId: "company-001",
          branchId: "branch-001",
          voucherDate: "2026-10-07",
          fiscalYearId: "fy",
          fiscalPeriodId: "fp",
          createdAtUtc: "2026-10-07T14:50:00.000Z",
          components: [],
          purpose: "accounting-recognition",
          payloadFingerprint: "a".repeat(64),
          expectedPostingVersion: 1,
          outboxEventId: "outbox-1",
          requestId: "request-001",
          causationId: null,
        },
        trace,
        requiresApproval: true,
        approval: null,
      },
    ),
    (error: unknown) =>
      error instanceof SalesPostingDomainError
      && error.code === SALES_POSTING_DOMAIN_ERROR_CODES.approvalRequired,
  );

  assert.deepEqual(fixture.requiredPermissions, [salesPostingPermissions.execute]);
});
