export const journalVoucherPermissions = Object.freeze({
  view: "accounting.journal-vouchers.view",
  create: "accounting.journal-vouchers.create",
  updateDraft: "accounting.journal-vouchers.update-draft",
  deleteDraft: "accounting.journal-vouchers.delete-draft",
  viewHistory: "accounting.journal-vouchers.view-history",
  submit: "accounting.journal-vouchers.submit",
  approve: "accounting.journal-vouchers.approve",
  reject: "accounting.journal-vouchers.reject",
  returnToDraft: "accounting.journal-vouchers.return-to-draft",
  cancelApproval: "accounting.journal-vouchers.cancel-approval",
  post: "accounting.journal-vouchers.post",
  reopenForAmendment: "accounting.journal-vouchers.reopen-for-amendment",
  reverse: "accounting.journal-vouchers.reverse",
} as const);

export type JournalVoucherPermission =
  (typeof journalVoucherPermissions)[keyof typeof journalVoucherPermissions];
