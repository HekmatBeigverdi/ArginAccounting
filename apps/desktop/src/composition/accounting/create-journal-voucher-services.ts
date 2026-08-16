import type {
  AccountingDimensionMember,
  AccountingDimensionType,
  AccountDimensionPolicy,
  AccountingDimensionSelectorModel,
} from "@argin/accounting";
import {
  createJournalVoucherDraft,
  deleteJournalVoucherDraft,
  getJournalVoucher,
  listJournalVouchers,
  searchJournalVouchers,
  updateJournalVoucherDraft,
  type CreateJournalVoucherCommand,
  type DeleteJournalVoucherDraftCommand,
  type GetJournalVoucherQuery,
  type JournalVoucherAccountReader,
  type JournalVoucherAuthorizer,
  type JournalVoucherDimensionReader,
  type JournalVoucherDto,
  type JournalVoucherFiscalContextReader,
  type JournalVoucherPageDto,
  type JournalVoucherRuntimeDependencies,
  type JournalVoucherSearchQuery,
  type JournalVoucherMutationResult,
  type ListJournalVouchersQuery,
  type UpdateJournalVoucherDraftCommand,
} from "@argin/accounting/journal";
import {
  SqliteAccountDimensionPolicyRepository,
  SqliteAccountingDimensionMemberRepository,
  SqliteAccountingDimensionSelectorService,
  SqliteAccountingDimensionTypeRepository,
  SqliteAccountRepository,
  SqliteJournalVoucherRepository,
  SqliteJournalVoucherUnitOfWork,
} from "@argin/accounting-tauri";
import type { DatabaseExecutor } from "@argin/database";
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
  NumberSeries,
  NumberSeriesRequest,
} from "@argin/platform";

export interface JournalAccountOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface JournalBranchOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface JournalVoucherDesktopServices {
  readonly authorizer: JournalVoucherAuthorizer;
  list(query: ListJournalVouchersQuery): Promise<JournalVoucherPageDto>;
  search(query: JournalVoucherSearchQuery): Promise<JournalVoucherPageDto>;
  get(query: GetJournalVoucherQuery): Promise<JournalVoucherDto>;
  create(command: CreateJournalVoucherCommand): Promise<JournalVoucherMutationResult>;
  update(command: UpdateJournalVoucherDraftCommand): Promise<JournalVoucherMutationResult>;
  delete(command: DeleteJournalVoucherDraftCommand): Promise<void>;
  listPostingAccounts(companyId: string): Promise<readonly JournalAccountOption[]>;
  listBranches(companyId: string): Promise<readonly JournalBranchOption[]>;
  loadDimensionSelector(input: {
    readonly companyId: string;
    readonly accountId: string;
    readonly documentDate: string;
    readonly assignments?: readonly {
      readonly dimensionTypeId: string;
      readonly memberIds: readonly string[];
    }[];
  }): Promise<AccountingDimensionSelectorModel>;
}

interface CreateJournalVoucherServicesInput {
  readonly database: DatabaseExecutor;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly eventBus: EventBus;
  readonly authorizer: JournalVoucherAuthorizer;
}

export function createJournalVoucherServices(
  input: CreateJournalVoucherServicesInput,
): JournalVoucherDesktopServices {
  const repository = new SqliteJournalVoucherRepository(input.database);
  const accountRepository = new SqliteAccountRepository(input.database);
  const fiscalYears = new SqliteFiscalYearRepository(input.database);
  const fiscalPeriods = new SqliteFiscalPeriodRepository(input.database);
  const dimensionTypes = new SqliteAccountingDimensionTypeRepository(input.database);
  const dimensionMembers = new SqliteAccountingDimensionMemberRepository(input.database);
  const dimensionPolicies = new SqliteAccountDimensionPolicyRepository(input.database);
  const dimensionSelector = new SqliteAccountingDimensionSelectorService(input.database);

  const accounts: JournalVoucherAccountReader = {
    findById: (id) => accountRepository.findById(id),
  };

  const fiscalContext: JournalVoucherFiscalContextReader = {
    async resolve(companyId, voucherDate) {
      const years = await fiscalYears.findByCompanyId(companyId);
      const year = years.find(
        (candidate) =>
          candidate.startDate <= voucherDate && voucherDate <= candidate.endDate,
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
        values.push(
          ...(await dimensionPolicies.findByAccountId(companyId, accountId)),
        );
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

  const runtime: JournalVoucherRuntimeDependencies = {
    authorizer: input.authorizer,
    clock: { now: () => input.clock.now() },
    identifiers: { generate: () => input.idGenerator.generate() },
    events: input.eventBus,
    numberSeries: new DesktopJournalNumberSeries(input.database),
    accounts,
    fiscalContext,
    dimensions,
    unitOfWork: new SqliteJournalVoucherUnitOfWork(input.database),
  };

  return Object.freeze({
    authorizer: input.authorizer,
    list: (query) => listJournalVouchers(query, repository, input.authorizer),
    search: (query) => searchJournalVouchers(query, repository, input.authorizer),
    get: (query) => getJournalVoucher(query, repository, input.authorizer),
    create: (command) => createJournalVoucherDraft(command, runtime),
    update: (command) => updateJournalVoucherDraft(command, runtime),
    async delete(command) {
      await deleteJournalVoucherDraft(command, runtime);
    },
    async listPostingAccounts(companyId) {
      const rows = await input.database.query<{
        id: string;
        code: string;
        name: string;
      }>(
        `SELECT id, code, name
         FROM accounts
         WHERE company_id = ?
           AND level = 'subsidiary'
           AND status = 'active'
           AND posting_allowed = 1
         ORDER BY code, id`,
        [companyId],
      );
      return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    },
    async listBranches(companyId) {
      const rows = await input.database.query<{
        id: string;
        code: string;
        name: string;
      }>(
        `SELECT id, code, name
         FROM branches
         WHERE company_id = ? AND status = 'active'
         ORDER BY code, id`,
        [companyId],
      );
      return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    },
    loadDimensionSelector: (request) => dimensionSelector.load(request),
  });
}

class DesktopJournalNumberSeries implements NumberSeries {
  constructor(private readonly database: DatabaseExecutor) {}

  async next(request: NumberSeriesRequest): Promise<GeneratedNumber> {
    return this.database.transaction(async (session) => {
      const repository = new SqliteNumberSeriesRepository(session);
      const branchId = request.scope.branchId ?? null;
      const fiscalYearId = request.scope.fiscalYearId ?? null;
      let series = await repository.findApplicable(
        request.scope.companyId,
        branchId,
        fiscalYearId,
        request.seriesType,
      );

      if (!series) {
        series = await repository.create({
          companyId: request.scope.companyId,
          branchId,
          fiscalYearId,
          entityType: request.seriesType,
          code: journalSeriesCode(branchId, fiscalYearId),
          startNumber: 1,
          paddingLength: 6,
          resetPolicy: "fiscal-year",
        });
      }

      const reserved = await repository.reserveNext(series.id);
      const sequence = reserved.reservedNumber;
      return Object.freeze({
        seriesType: request.seriesType,
        scope: Object.freeze({ ...request.scope }),
        sequence,
        formattedValue:
          `${series.prefix}${String(sequence).padStart(series.paddingLength, "0")}${series.suffix}`,
      });
    });
  }
}

function journalSeriesCode(
  branchId: string | null,
  fiscalYearId: string | null,
): string {
  return `JV:${fiscalYearId ?? "*"}:${branchId ?? "*"}`;
}
