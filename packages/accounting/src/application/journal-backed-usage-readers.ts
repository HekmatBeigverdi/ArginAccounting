import type { AccountUsageReader } from "../contracts/account-usage-reader.ts";
import type { AccountingDimensionUsageReader } from "../contracts/accounting-dimension-usage-reader.ts";
import type { JournalVoucherUsageReader } from "../contracts/journal-voucher-repository.ts";

export class JournalBackedAccountUsageReader implements AccountUsageReader {
  constructor(
    private readonly journalUsage: JournalVoucherUsageReader,
    private readonly fallbackUsage?: AccountUsageReader,
  ) {}

  async hasFinancialActivity(
    companyId: string,
    accountId: string,
  ): Promise<boolean> {
    const usedByJournal = await this.journalUsage.isAccountUsed(accountId);
    if (usedByJournal) return true;

    return this.fallbackUsage?.hasFinancialActivity(companyId, accountId) ?? false;
  }
}

export class JournalBackedAccountingDimensionUsageReader
  implements AccountingDimensionUsageReader
{
  constructor(
    private readonly journalUsage: JournalVoucherUsageReader,
    private readonly structuralUsage?: AccountingDimensionUsageReader,
  ) {}

  async isDimensionTypeInUse(
    companyId: string,
    dimensionTypeId: string,
  ): Promise<boolean> {
    const usedByJournal = await this.journalUsage.isDimensionTypeUsed(
      dimensionTypeId,
    );
    if (usedByJournal) return true;

    return this.structuralUsage?.isDimensionTypeInUse(
      companyId,
      dimensionTypeId,
    ) ?? false;
  }

  async isMemberInUse(
    companyId: string,
    memberId: string,
  ): Promise<boolean> {
    const usedByJournal = await this.journalUsage.isDimensionMemberUsed(memberId);
    if (usedByJournal) return true;

    return this.structuralUsage?.isMemberInUse(companyId, memberId) ?? false;
  }
}
