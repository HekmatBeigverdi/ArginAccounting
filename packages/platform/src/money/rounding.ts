export type MoneyRoundingMode =
  | "half-away-from-zero"
  | "floor"
  | "ceiling"
  | "truncate";

export function roundMoneyValue(
  value: number,
  mode: MoneyRoundingMode = "half-away-from-zero",
): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Money calculation result must be finite.");
  }

  switch (mode) {
    case "floor":
      return Math.floor(value);

    case "ceiling":
      return Math.ceil(value);

    case "truncate":
      return Math.trunc(value);

    case "half-away-from-zero":
      return value < 0
        ? -Math.round(Math.abs(value))
        : Math.round(value);
  }
}
