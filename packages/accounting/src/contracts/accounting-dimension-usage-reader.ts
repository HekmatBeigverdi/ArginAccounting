export interface AccountingDimensionUsageReader {
  isDimensionTypeInUse(companyId: string, dimensionTypeId: string): Promise<boolean>;
  isMemberInUse(companyId: string, memberId: string): Promise<boolean>;
}
