import type {
  AccountCodingSettings,
} from "../domain/account-coding-settings.ts";

export interface AccountCodingSettingsRepository {
  findByCompanyId(
    companyId: string,
  ): Promise<AccountCodingSettings | null>;
  save(settings: AccountCodingSettings): Promise<void>;
}
