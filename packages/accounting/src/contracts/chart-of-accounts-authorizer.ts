export interface ChartOfAccountsAuthorizer {
  hasPermission(permission: string): Promise<boolean>;
}
