import type {
  AccountingDimensionMember,
  AccountingDimensionType,
  AccountDimensionPolicy,
} from "@argin/accounting";
import {
  createJournalVoucherLifecycleAuditRecorder,
  getJournalVoucherLifecycle,
  handlePostJournalVoucherLifecycleCommand,
  handleReverseJournalVoucherLifecycleCommand,
  type JournalVoucherAccountReader,
  type JournalVoucherDimensionReader,
  type JournalVoucherFiscalContextReader,
  type JournalVoucherLifecycleDto,
  type PostJournalVoucherLifecycleCommand,
  type ReverseJournalVoucherLifecycleCommand,
} from "@argin/accounting/journal";
import {
  SqliteAccountDimensionPolicyRepository,
  SqliteAccountingDimensionMemberRepository,
  SqliteAccountingDimensionTypeRepository,
  SqliteAccountRepository,
  SqliteJournalVoucherLifecycleReader,
  SqliteJournalVoucherPostingUnitOfWork,
  SqliteJournalVoucherReversalUnitOfWork,
} from "@argin/accounting-tauri";
import {
  SqliteApprovalRepository,
  SqliteAuditRepository,
  SqliteAuditUnitOfWork,
  type SqliteDatabase,
} from "@argin/audit-tauri";
import type {
  DatabaseExecutor,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import {
  SqliteFiscalPeriodRepository,
  SqliteFiscalYearRepository,
  SqliteNumberSeriesRepository,
} from "@argin/fiscal-tauri";
import type {
  Clock,
  EventBus,
  GeneratedNumber,
  IdGenerator,
  NotificationService,
  NumberSeries,
  NumberSeriesRequest,
} from "@argin/platform";

export interface JournalLifecycleDesktopServices {
  get(companyId: string, voucherId: string): Promise<JournalVoucherLifecycleDto>;
  post(command: PostJournalVoucherLifecycleCommand): ReturnType<typeof handlePostJournalVoucherLifecycleCommand>;
  reverse(command: ReverseJournalVoucherLifecycleCommand): ReturnType<typeof handleReverseJournalVoucherLifecycleCommand>;
}

interface CreateJournalLifecycleServicesInput {
  readonly database: DatabaseExecutor;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly eventBus: EventBus;
  readonly notificationService: NotificationService;
  readonly authorizer: {
    hasPermission(permission: string): Promise<boolean>;
  };
}

export function createJournalLifecycleServices(
  input: CreateJournalLifecycleServicesInput,
): JournalLifecycleDesktopServices {
  const accountRepository = new SqliteAccountRepository(input.database);
  const fiscalYears = new SqliteFiscalYearRepository(input.database);
  const fiscalPeriods = new SqliteFiscalPeriodRepository(input.database);
  const dimensionTypes = new SqliteAccountingDimensionTypeRepository(input.database);
  const dimensionMembers = new SqliteAccountingDimensionMemberRepository(input.database);
  const dimensionPolicies = new SqliteAccountDimensionPolicyRepository(input.database);
  const lifecycleReader = new SqliteJournalVoucherLifecycleReader(input.database);
  const auditDatabase = asAuditDatabase(input.database);
  const approvalRepository = new SqliteApprovalRepository(auditDatabase);

  const accounts: JournalVoucherAccountReader = {
    findById: (id) => accountRepository.findById(id),
  };

  const fiscalContext: JournalVoucherFiscalContextReader = {
    async resolve(companyId, voucherDate) {
      const years = await fiscalYears.findByCompanyId(companyId);
      const year = years.find(
        (candidate) => candidate.startDate <= voucherDate && voucherDate <= candidate.endDate,
      );
      if (!year) return null;
      const period = await fiscalPeriods.findByDate(year.id, voucherDate);
      if (!period) return null;
      return Object.freeze({
        companyId: year.companyId,
        fiscalYearId: year.id,
        fiscalYearStartDate: year.startDate,
        fiscalYearEndDate: year.endDate,
        fiscalYearStatus: year.status,
        fiscalPeriodId: period.id,
        fiscalPeriodStartDate: period.startDate,
        fiscalPeriodEndDate: period.endDate,
        fiscalPeriodStatus: period.status,
      });
    },
  };

  const dimensions: JournalVoucherDimensionReader = {
    async findPoliciesForAccounts(companyId, accountIds) {
      const values: AccountDimensionPolicy[] = [];
      for (const accountId of [...new Set(accountIds)]) {
        values.push(...(await dimensionPolicies.findByAccountId(companyId, accountId)));
      }
      return Object.freeze(values);
    },
    async findTypesByCompanyId(companyId) {
      const values: AccountingDimensionType[] = [];
      let page = 1;
      do {
        const result = await dimensionTypes.search({
          companyId,
          pagination: { page, pageSize: 100 },
        });
        values.push(...result.items);
        if (!result.hasNextPage) break;
        page += 1;
      } while (true);
      return Object.freeze(values);
    },
    async findMembersByIds(ids) {
      const values: AccountingDimensionMember[] = [];
      for (const id of [...new Set(ids)]) {
        const member = await dimensionMembers.findById(id);
        if (member) values.push(member);
      }
      return Object.freeze(values);
    },
  };

  const authorization = {
    authorizer: input.authorizer,
    evidence: {
      async getCurrentApprovalRequest(voucherId: string) {
        const cycle = await lifecycleReader.findCurrentApprovalCycle(voucherId);
        return cycle ? approvalRepository.findById(cycle.approvalRequestId) : null;
      },
    },
  };

  const effects = {
    audit: createJournalVoucherLifecycleAuditRecorder({
      idGenerator: { generate: () => input.idGenerator.generate() },
      clock: { now: () => input.clock.now().toISOString() },
      authorizer: { async hasPermission() { return true; } },
      unitOfWork: new SqliteAuditUnitOfWork(auditDatabase),
      auditRepository: new SqliteAuditRepository(auditDatabase),
      auditSource: "desktop",
    }),
    events: input.eventBus,
    notifications: input.notificationService,
  };

  const posting = {
    accounts,
    fiscalContext,
    dimensions,
    unitOfWork: new SqliteJournalVoucherPostingUnitOfWork(
      input.database,
      (session) => {
        const approvals = new SqliteApprovalRepository(asAuditDatabase(session));
        return { getApprovalRequest: (id: string) => approvals.findById(id) };
      },
    ),
  };

  const reversal = {
    accounts,
    fiscalContext,
    dimensions,
    identifiers: { generate: () => input.idGenerator.generate() },
    numberSeries: new DesktopLifecycleJournalNumberSeries(input.database),
    unitOfWork: new SqliteJournalVoucherReversalUnitOfWork(input.database),
  };

  return Object.freeze({
    get: (companyId, voucherId) =>
      getJournalVoucherLifecycle({ companyId, voucherId }, lifecycleReader),
    post: (command) => handlePostJournalVoucherLifecycleCommand(command, {
      authorization,
      posting,
      effects,
    }),
    reverse: (command) => handleReverseJournalVoucherLifecycleCommand(command, {
      authorization,
      reversal,
      effects,
    }),
  });
}

function asAuditDatabase(database: DatabaseExecutor | DatabaseSession): SqliteDatabase {
  return {
    execute: (sql, parameters = []) =>
      database.execute(sql, parameters as readonly DatabaseValue[]),
    async select<T>(sql: string, parameters: unknown[] = []): Promise<T> {
      return database.query(sql, parameters as readonly DatabaseValue[]) as Promise<T>;
    },
  };
}

class DesktopLifecycleJournalNumberSeries implements NumberSeries {
  constructor(private readonly database: DatabaseExecutor) {}

  async next(request: NumberSeriesRequest): Promise<GeneratedNumber> {
    return this.database.transaction(async (session) => {
      const repository = new SqliteNumberSeriesRepository(session);
      const branchId = request.scope.branchId ?? null;
      const fiscalYearId = request.scope.fiscalYearId ?? null;
      const code = `JV:${fiscalYearId ?? "*"}:${branchId ?? "*"}`;
      let series = await repository.findByCode(request.scope.companyId, code);
      if (!series) {
        series = await repository.create({
          companyId: request.scope.companyId,
          branchId,
          fiscalYearId,
          entityType: request.seriesType,
          code,
          startNumber: 1,
          paddingLength: 6,
          resetPolicy: "fiscal-year",
        });
      }
      const reserved = await repository.reserveNext(series.id);
      return Object.freeze({
        seriesType: request.seriesType,
        scope: Object.freeze({ ...request.scope }),
        sequence: reserved.reservedNumber,
        formattedValue:
          `${series.prefix}${String(reserved.reservedNumber).padStart(series.paddingLength, "0")}${series.suffix}`,
      });
    });
  }
}
