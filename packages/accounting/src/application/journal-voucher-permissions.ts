export const journalVoucherPermissions = Object.freeze({
  view: "accounting.journal-vouchers.view",
  create: "accounting.journal-vouchers.create",
  updateDraft: "accounting.journal-vouchers.update-draft",
  deleteDraft: "accounting.journal-vouchers.delete-draft",
  viewHistory: "accounting.journal-vouchers.view-history",
} as const);

export type JournalVoucherPermission =
  (typeof journalVoucherPermissions)[keyof typeof journalVoucherPermissions];
