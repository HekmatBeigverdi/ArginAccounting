export interface NumberSeriesScope {
  readonly companyId: string;
  readonly branchId?: string;
  readonly fiscalYearId?: string;
}

export function createNumberSeriesScopeKey(
  scope: NumberSeriesScope,
): string {
  const companyId = normalizeScopeValue(
    scope.companyId,
    "companyId",
  );

  const branchId = normalizeOptionalScopeValue(
    scope.branchId,
    "branchId",
  );

  const fiscalYearId = normalizeOptionalScopeValue(
    scope.fiscalYearId,
    "fiscalYearId",
  );

  return [
    encodeScopePart("company", companyId),
    encodeScopePart("branch", branchId),
    encodeScopePart("fiscal-year", fiscalYearId),
  ].join("|");
}

function normalizeScopeValue(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `Number series scope ${fieldName} must not be empty.`,
    );
  }

  return normalized;
}

function normalizeOptionalScopeValue(
  value: string | undefined,
  fieldName: string,
): string {
  if (value === undefined) {
    return "*";
  }

  return normalizeScopeValue(value, fieldName);
}

function encodeScopePart(
  name: string,
  value: string,
): string {
  return `${name}:${value.length}:${value}`;
}
