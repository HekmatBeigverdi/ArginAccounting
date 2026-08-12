import type {
  GeneratedNumber,
  NumberSeries,
  NumberSeriesDefinition,
  NumberSeriesScope,
} from "@argin/platform";

export const JOURNAL_VOUCHER_NUMBER_SERIES_TYPE =
  "accounting.journal-voucher" as const;

export const DEFAULT_JOURNAL_VOUCHER_NUMBER_SERIES_DEFINITION:
  NumberSeriesDefinition = Object.freeze({
    seriesType: JOURNAL_VOUCHER_NUMBER_SERIES_TYPE,
    initialValue: 1,
    incrementBy: 1,
    padding: 6,
    prefix: "",
    suffix: "",
  });

export interface JournalVoucherNumberScope {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId: string;
}

export interface JournalVoucherNumberReservation {
  readonly sequence: number;
  readonly formattedValue: string;
  readonly seriesType: typeof JOURNAL_VOUCHER_NUMBER_SERIES_TYPE;
  readonly scope: NumberSeriesScope;
}

export async function reserveJournalVoucherNumber(
  numberSeries: NumberSeries,
  scope: JournalVoucherNumberScope,
): Promise<JournalVoucherNumberReservation> {
  const generated = await numberSeries.next({
    seriesType: JOURNAL_VOUCHER_NUMBER_SERIES_TYPE,
    scope: createJournalVoucherNumberSeriesScope(scope),
  });

  return toJournalVoucherNumberReservation(generated);
}

export function createJournalVoucherNumberSeriesScope(
  scope: JournalVoucherNumberScope,
): NumberSeriesScope {
  return Object.freeze({
    companyId: requireIdentifier(scope.companyId, "companyId"),
    ...(scope.branchId === null
      ? {}
      : { branchId: requireIdentifier(scope.branchId, "branchId") }),
    fiscalYearId: requireIdentifier(scope.fiscalYearId, "fiscalYearId"),
  });
}

function toJournalVoucherNumberReservation(
  generated: GeneratedNumber,
): JournalVoucherNumberReservation {
  if (generated.seriesType !== JOURNAL_VOUCHER_NUMBER_SERIES_TYPE) {
    throw new TypeError(
      "Generated number does not belong to the Journal Voucher series.",
    );
  }

  return Object.freeze({
    sequence: generated.sequence,
    formattedValue: generated.formattedValue,
    seriesType: JOURNAL_VOUCHER_NUMBER_SERIES_TYPE,
    scope: Object.freeze({ ...generated.scope }),
  });
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new TypeError(`Journal voucher number scope ${field} is required.`);
  }
  if (normalized.length > 128) {
    throw new TypeError(
      `Journal voucher number scope ${field} cannot exceed 128 characters.`,
    );
  }
  return normalized;
}
