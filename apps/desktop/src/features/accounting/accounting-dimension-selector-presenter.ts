import type {
  AccountingDimensionAssignment,
  AccountingDimensionSelectorModel,
} from "@argin/accounting";

export function updateAccountingDimensionAssignments(
  model: AccountingDimensionSelectorModel,
  dimensionTypeId: string,
  memberIds: readonly string[],
): readonly AccountingDimensionAssignment[] {
  const assignments = model.fields
    .filter(
      (field) =>
        field.dimensionTypeId !== dimensionTypeId &&
        field.selectedMemberIds.length > 0,
    )
    .map((field) => ({
      dimensionTypeId: field.dimensionTypeId,
      memberIds: field.selectedMemberIds,
    }));

  if (memberIds.length > 0) {
    assignments.push({ dimensionTypeId, memberIds });
  }
  return assignments;
}
