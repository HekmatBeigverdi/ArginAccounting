import type { NumberSeriesDefinition } from "./number-series.ts";

export interface NormalizedNumberSeriesDefinition {
  readonly seriesType: string;
  readonly initialValue: number;
  readonly incrementBy: number;
  readonly padding: number;
  readonly prefix: string;
  readonly suffix: string;
}

export function normalizeNumberSeriesDefinition(
  definition: NumberSeriesDefinition,
): NormalizedNumberSeriesDefinition {
  const seriesType = normalizeSeriesType(
    definition.seriesType,
  );

  const initialValue = definition.initialValue ?? 1;
  const incrementBy = definition.incrementBy ?? 1;
  const padding = definition.padding ?? 1;
  const prefix = definition.prefix ?? "";
  const suffix = definition.suffix ?? "";

  assertPositiveSafeInteger(
    initialValue,
    "initialValue",
  );

  assertPositiveSafeInteger(
    incrementBy,
    "incrementBy",
  );

  assertPositiveSafeInteger(
    padding,
    "padding",
  );

  if (padding > 30) {
    throw new RangeError(
      "Number series padding must not exceed 30.",
    );
  }

  return {
    seriesType,
    initialValue,
    incrementBy,
    padding,
    prefix,
    suffix,
  };
}

export function normalizeSeriesType(
  seriesType: string,
): string {
  const normalized = seriesType.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      "Number series type must not be empty.",
    );
  }

  if (
    !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/.test(
      normalized,
    )
  ) {
    throw new TypeError(
      "Number series type must use lowercase " +
      "module-prefixed dot-separated notation.",
    );
  }

  return normalized;
}

function assertPositiveSafeInteger(
  value: number,
  fieldName: string,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new RangeError(
      `Number series ${fieldName} must be a positive safe integer.`,
    );
  }
}
