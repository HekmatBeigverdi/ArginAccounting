export const accountingReportPermissions = Object.freeze({
  viewTrialBalance: "accounting.reports.trial-balance.view",
  viewGeneralLedger: "accounting.reports.general-ledger.view",
  viewSubsidiaryLedger: "accounting.reports.subsidiary-ledger.view",
  viewJournal: "accounting.reports.journal.view",
  viewDimensions: "accounting.reports.dimensions.view",
  export: "accounting.reports.export",
} as const);

export type AccountingReportPermission =
  (typeof accountingReportPermissions)[keyof typeof accountingReportPermissions];
