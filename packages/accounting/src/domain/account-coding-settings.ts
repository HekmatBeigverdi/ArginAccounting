export interface AccountCodingSettings {
  readonly companyId: string;
  readonly groupCodeLength: number;
  readonly generalCodeLength: number;
  readonly subsidiaryCodeLength: number;
  readonly enforceHierarchicalCodes: boolean;
  readonly allowCodeChangeAfterUse: boolean;
  readonly version: number;
}

export interface CreateAccountCodingSettingsInput {
  readonly companyId: string;
  readonly groupCodeLength?: number;
  readonly generalCodeLength?: number;
  readonly subsidiaryCodeLength?: number;
  readonly enforceHierarchicalCodes?: boolean;
  readonly allowCodeChangeAfterUse?: boolean;
}

export const DEFAULT_ACCOUNT_CODE_LENGTHS = Object.freeze({
  group: 2,
  general: 4,
  subsidiary: 6,
});
