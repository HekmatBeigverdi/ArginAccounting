import type { DomainEvent, NumberSeries } from "@argin/platform";
import type { Account } from "../domain/account.ts";
import type { AccountDimensionPolicy } from "../domain/account-dimension-policy.ts";
import type { AccountingDimensionMember } from "../domain/accounting-dimension-member.ts";
import type { AccountingDimensionType } from "../domain/accounting-dimension-type.ts";
import type { JournalFiscalContext } from "../validation/journal-voucher-eligibility.ts";
import type { JournalVoucherRepository } from "./journal-voucher-repository.ts";

export interface JournalVoucherAuthorizer {
  hasPermission(permission: string): Promise<boolean>;
}

export interface JournalVoucherClock {
  now(): Date;
}

export interface JournalVoucherIdentifierGenerator {
  generate(): string;
}

export interface JournalVoucherEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: readonly DomainEvent[]): Promise<void>;
}

export interface JournalVoucherAccountReader {
  findById(id: string): Promise<Account | null>;
}

export interface JournalVoucherFiscalContextReader {
  resolve(
    companyId: string,
    voucherDate: string,
  ): Promise<JournalFiscalContext | null>;
}

export interface JournalVoucherDimensionReader {
  findPoliciesForAccounts(
    companyId: string,
    accountIds: readonly string[],
  ): Promise<readonly AccountDimensionPolicy[]>;
  findTypesByCompanyId(
    companyId: string,
  ): Promise<readonly AccountingDimensionType[]>;
  findMembersByIds(
    ids: readonly string[],
  ): Promise<readonly AccountingDimensionMember[]>;
}

export interface JournalVoucherUnitOfWorkRepositories {
  readonly journals: JournalVoucherRepository;
}

export interface JournalVoucherUnitOfWork {
  run<T>(
    operation: (
      repositories: JournalVoucherUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T>;
}

export interface JournalVoucherRuntimeDependencies {
  readonly authorizer: JournalVoucherAuthorizer;
  readonly clock: JournalVoucherClock;
  readonly identifiers: JournalVoucherIdentifierGenerator;
  readonly events: JournalVoucherEventPublisher;
  readonly numberSeries: NumberSeries;
  readonly accounts: JournalVoucherAccountReader;
  readonly fiscalContext: JournalVoucherFiscalContextReader;
  readonly dimensions: JournalVoucherDimensionReader;
  readonly unitOfWork: JournalVoucherUnitOfWork;
}
