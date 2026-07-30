export const chartOfAccountsPermissions = Object.freeze({
  view: "accounting.chart-of-accounts.view",
  create: "accounting.chart-of-accounts.create",
  update: "accounting.chart-of-accounts.update",
  changeCode: "accounting.chart-of-accounts.change-code",
  move: "accounting.chart-of-accounts.move",
  changeStatus: "accounting.chart-of-accounts.change-status",
  manageSettings: "accounting.chart-of-accounts.manage-settings",
} as const);

export type ChartOfAccountsPermission =
  (typeof chartOfAccountsPermissions)[keyof typeof chartOfAccountsPermissions];

