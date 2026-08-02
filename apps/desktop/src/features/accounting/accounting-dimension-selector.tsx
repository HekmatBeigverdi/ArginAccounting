import type {
  AccountingDimensionAssignment,
  AccountingDimensionSelectorModel,
} from "@argin/accounting";

import { updateAccountingDimensionAssignments } from "./accounting-dimension-selector-presenter";

export interface AccountingDimensionSelectorProps {
  readonly model: AccountingDimensionSelectorModel;
  readonly disabled?: boolean;
  readonly onChange: (
    assignments: readonly AccountingDimensionAssignment[],
  ) => void;
}

export function AccountingDimensionSelector({
  model,
  disabled = false,
  onChange,
}: AccountingDimensionSelectorProps) {
  function change(dimensionTypeId: string, memberIds: readonly string[]): void {
    onChange(
      updateAccountingDimensionAssignments(model, dimensionTypeId, memberIds),
    );
  }

  if (model.fields.length === 0) {
    return (
      <p className="accounting-dimension-selector__empty">
        برای این حساب بُعد حسابداری تعریف نشده است.
      </p>
    );
  }

  return (
    <fieldset
      className="accounting-dimension-selector"
      dir="rtl"
      disabled={disabled}
    >
      <legend>ابعاد حسابداری</legend>
      {model.fields.map((field) => (
        <label
          className="accounting-dimension-selector__field"
          key={field.dimensionTypeId}
        >
          <span>
            {field.label}
            {field.required ? " *" : ""}
          </span>
          {field.disabled ? (
            <span className="accounting-dimension-selector__forbidden">
              تخصیص این بُعد برای حساب انتخاب‌شده ممنوع است.
            </span>
          ) : (
            <select
              aria-label={field.label}
              multiple={field.multiple}
              required={field.required}
              value={
                field.multiple
                  ? [...field.selectedMemberIds]
                  : (field.selectedMemberIds[0] ?? "")
              }
              onChange={(event) => {
                const memberIds = field.multiple
                  ? [...event.currentTarget.selectedOptions].map(
                      (option) => option.value,
                    )
                  : event.currentTarget.value === ""
                    ? []
                    : [event.currentTarget.value];
                change(field.dimensionTypeId, memberIds);
              }}
            >
              {!field.multiple && <option value="">انتخاب کنید</option>}
              {field.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.code} — {option.name}
                </option>
              ))}
            </select>
          )}
          {!field.disabled && field.options.length === 0 && (
            <small>عضو فعال و معتبر برای تاریخ سند وجود ندارد.</small>
          )}
        </label>
      ))}
    </fieldset>
  );
}
