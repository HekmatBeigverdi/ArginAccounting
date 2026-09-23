import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import { SqliteJournalVoucherRepository } from "@argin/accounting-tauri";
import type {
  JournalVoucherReversalResult,
  ReverseJournalVoucherCommand,
} from "@argin/accounting/journal";
import type {
  PurchasePostingAtomicSession,
  PurchasePostingAtomicUnitOfWork,
  PurchasePostingReplaySession,
  PurchasePostingReplayUnitOfWork,
  PurchasePostingReversalSession,
  PurchasePostingReversalUnitOfWork,
} from "@argin/purchase-posting";
import {
  SqlitePurchasePostingIdempotencyRepository,
  SqlitePurchasePostingRepository,
  SqlitePurchasePostingReversalRepository,
  SqlitePurchasePostingRuleRepository,
} from "./sqlite-purchase-posting-repositories.ts";
import {
  SqlitePurchasePostingAccountReader,
  SqlitePurchasePostingDimensionReader,
  SqlitePurchasePostingFiscalReader,
} from "./sqlite-purchase-posting-readers.ts";
import type {
  PurchasePostingDimensionTypeIdMap,
} from "./sqlite-purchase-posting-readers.ts";

export interface SqlitePurchasePostingContext {
  readonly postings: SqlitePurchasePostingRepository;
  readonly rules: SqlitePurchasePostingRuleRepository;
  readonly idempotency: SqlitePurchasePostingIdempotencyRepository;
  readonly reversals: SqlitePurchasePostingReversalRepository;
  readonly accounts: SqlitePurchasePostingAccountReader;
  readonly dimensions: SqlitePurchasePostingDimensionReader;
  readonly fiscal: SqlitePurchasePostingFiscalReader;
  readonly journals: SqliteJournalVoucherRepository;
}

const contextFor = (
  session: DatabaseSession,
  dimensionTypeIds: PurchasePostingDimensionTypeIdMap,
): SqlitePurchasePostingContext => Object.freeze({
  postings: new SqlitePurchasePostingRepository(session),
  rules: new SqlitePurchasePostingRuleRepository(session),
  idempotency: new SqlitePurchasePostingIdempotencyRepository(session),
  reversals: new SqlitePurchasePostingReversalRepository(session),
  accounts: new SqlitePurchasePostingAccountReader(session),
  dimensions: new SqlitePurchasePostingDimensionReader(session, dimensionTypeIds),
  fiscal: new SqlitePurchasePostingFiscalReader(session),
  journals: new SqliteJournalVoucherRepository(session),
});

export class SqlitePurchasePostingUnitOfWork {
  private readonly sessions = new WeakMap<SqlitePurchasePostingContext, DatabaseSession>();

  constructor(
    private readonly database: DatabaseExecutor,
    private readonly dimensionTypeIds: PurchasePostingDimensionTypeIdMap = Object.freeze({}),
  ) {}

  sessionFor(context: SqlitePurchasePostingContext): DatabaseSession {
    const session = this.sessions.get(context);
    if (!session) throw new Error("Purchase Posting transaction context is not active.");
    return session;
  }

  execute<T>(work: (context: SqlitePurchasePostingContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async session => {
      const context = contextFor(session, this.dimensionTypeIds);
      this.sessions.set(context, session);
      try {
        return await work(context);
      } finally {
        this.sessions.delete(context);
      }
    });
  }
}

const atomicSession = (
  context: SqlitePurchasePostingContext,
): PurchasePostingAtomicSession => ({
  findPosting: id => context.postings.findById(id),
  resolveFiscalContext: (companyId, operationDate) =>
    context.fiscal.resolve(companyId, operationDate),
  findActiveHistoricalLocks: (companyId, branchId, scope) =>
    context.fiscal.findActiveHistoricalLocks(companyId, branchId, scope),
  createJournalDraft: voucher => context.journals.create(voucher),
  savePreparedPosting: (posting, expectedVersion) =>
    context.postings.update(posting, expectedVersion),
});

export class SqlitePurchasePostingAtomicUnitOfWork implements PurchasePostingAtomicUnitOfWork {
  private readonly base: SqlitePurchasePostingUnitOfWork;

  constructor(
    database: DatabaseExecutor,
    dimensionTypeIds: PurchasePostingDimensionTypeIdMap = Object.freeze({}),
  ) {
    this.base = new SqlitePurchasePostingUnitOfWork(database, dimensionTypeIds);
  }

  run<T>(work: (session: PurchasePostingAtomicSession) => Promise<T>): Promise<T> {
    return this.base.execute(context => work(atomicSession(context)));
  }
}

const replaySession = (
  context: SqlitePurchasePostingContext,
): PurchasePostingReplaySession => ({
  ...atomicSession(context),
  findIdempotencyRecord: key => context.idempotency.findByKey(key),
  findPreparedPosting: id => context.postings.findById(id),
  findJournalDraft: id => context.journals.findById(id),
  saveIdempotencyRecord: record => context.idempotency.add(record),
});

export class SqlitePurchasePostingReplayUnitOfWork implements PurchasePostingReplayUnitOfWork {
  private readonly base: SqlitePurchasePostingUnitOfWork;

  constructor(
    database: DatabaseExecutor,
    dimensionTypeIds: PurchasePostingDimensionTypeIdMap = Object.freeze({}),
  ) {
    this.base = new SqlitePurchasePostingUnitOfWork(database, dimensionTypeIds);
  }

  run<T>(work: (session: PurchasePostingReplaySession) => Promise<T>): Promise<T> {
    return this.base.execute(context => work(replaySession(context)));
  }
}

export type PurchasePostingJournalReverser = (
  databaseSession: DatabaseSession,
  command: ReverseJournalVoucherCommand,
) => Promise<JournalVoucherReversalResult>;

export class SqlitePurchasePostingReversalUnitOfWork implements PurchasePostingReversalUnitOfWork {
  private readonly base: SqlitePurchasePostingUnitOfWork;

  constructor(
    database: DatabaseExecutor,
    private readonly reverseJournalInSession: PurchasePostingJournalReverser,
    dimensionTypeIds: PurchasePostingDimensionTypeIdMap = Object.freeze({}),
  ) {
    this.base = new SqlitePurchasePostingUnitOfWork(database, dimensionTypeIds);
  }

  run<T>(work: (session: PurchasePostingReversalSession) => Promise<T>): Promise<T> {
    return this.base.execute(async context => {
      const databaseSession = this.base.sessionFor(context);
      const session: PurchasePostingReversalSession = {
        findPosting: id => context.postings.findById(id),
        resolveFiscalContext: (companyId, operationDate) =>
          context.fiscal.resolve(companyId, operationDate),
        findActiveHistoricalLocks: (companyId, branchId, scope) =>
          context.fiscal.findActiveHistoricalLocks(companyId, branchId, scope),
        findReversalByRequestId: (companyId, requestId) =>
          context.reversals.findByRequestId(companyId, requestId),
        reverseJournal: command =>
          this.reverseJournalInSession(databaseSession, command),
        saveReversedPosting: async (posting, expectedVersion, reversal) => {
          await context.postings.update(posting, expectedVersion);
          await context.reversals.add(posting.companyId, reversal);
        },
      };
      return work(session);
    });
  }
}
