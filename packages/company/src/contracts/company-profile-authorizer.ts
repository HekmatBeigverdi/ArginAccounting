export interface CompanyProfileAuthorizer {
  hasPermission(permission: string): Promise<boolean>;
}
