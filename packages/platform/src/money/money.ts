import { PlatformError } from "../common/platform-error.ts";
import {
  IRR,
  normalizeCurrencyCode,
  type CurrencyCode,
} from "./currency.ts";
import {
  roundMoneyValue,
  type MoneyRoundingMode,
} from "./rounding.ts";

export interface MoneyValue {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export class Money {
  readonly #amount: number;
  readonly #currency: CurrencyCode;

  private constructor(
    amount: number,
    currency: CurrencyCode,
  ) {
    this.#amount = amount;
    this.#currency = currency;
  }

  static fromRials(amount: number): Money {
    return Money.create(amount, IRR.code);
  }

  static zero(currency: CurrencyCode = IRR.code): Money {
    return Money.create(0, currency);
  }

  static create(
    amount: number,
    currency: CurrencyCode = IRR.code,
  ): Money {
    Money.assertValidAmount(amount);

    return new Money(
      amount,
      normalizeCurrencyCode(currency),
    );
  }

  static from(value: MoneyValue): Money {
    return Money.create(value.amount, value.currency);
  }

  get amount(): number {
    return this.#amount;
  }

  get currency(): CurrencyCode {
    return this.#currency;
  }

  get isZero(): boolean {
    return this.#amount === 0;
  }

  get isPositive(): boolean {
    return this.#amount > 0;
  }

  get isNegative(): boolean {
    return this.#amount < 0;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);

    return Money.create(
      Money.safeAdd(this.#amount, other.#amount),
      this.#currency,
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);

    return Money.create(
      Money.safeSubtract(this.#amount, other.#amount),
      this.#currency,
    );
  }

  negate(): Money {
    if (this.#amount === Number.MIN_SAFE_INTEGER) {
      throw Money.amountOutOfRange(this.#amount);
    }

    return Money.create(-this.#amount, this.#currency);
  }

  absolute(): Money {
    return this.#amount < 0 ? this.negate() : this;
  }

  multiply(
    multiplier: number,
    roundingMode: MoneyRoundingMode = "half-away-from-zero",
  ): Money {
    Money.assertFiniteOperand(multiplier, "multiplier");

    const result = roundMoneyValue(
      this.#amount * multiplier,
      roundingMode,
    );

    return Money.create(result, this.#currency);
  }

  divide(
    divisor: number,
    roundingMode: MoneyRoundingMode = "half-away-from-zero",
  ): Money {
    Money.assertFiniteOperand(divisor, "divisor");

    if (divisor === 0) {
      throw PlatformError.validation(
        "money.division-by-zero",
        "Money cannot be divided by zero.",
      );
    }

    const result = roundMoneyValue(
      this.#amount / divisor,
      roundingMode,
    );

    return Money.create(result, this.#currency);
  }

  percentage(
    percent: number,
    roundingMode: MoneyRoundingMode = "half-away-from-zero",
  ): Money {
    Money.assertFiniteOperand(percent, "percent");

    return this.multiply(percent / 100, roundingMode);
  }

  compareTo(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);

    if (this.#amount < other.#amount) {
      return -1;
    }

    if (this.#amount > other.#amount) {
      return 1;
    }

    return 0;
  }

  equals(other: Money): boolean {
    return (
      this.#amount === other.#amount &&
      this.#currency === other.#currency
    );
  }

  allocate(parts: number): readonly Money[] {
    if (!Number.isSafeInteger(parts) || parts <= 0) {
      throw PlatformError.validation(
        "money.invalid-allocation-parts",
        "Money allocation parts must be a positive safe integer.",
        { parts },
      );
    }

    const quotient = Math.trunc(this.#amount / parts);
    let remainder = this.#amount - quotient * parts;

    const allocations: Money[] = [];

    for (let index = 0; index < parts; index += 1) {
      let adjustment = 0;

      if (remainder > 0) {
        adjustment = 1;
        remainder -= 1;
      } else if (remainder < 0) {
        adjustment = -1;
        remainder += 1;
      }

      allocations.push(
        Money.create(quotient + adjustment, this.#currency),
      );
    }

    return allocations;
  }

  toValue(): MoneyValue {
    return {
      amount: this.#amount,
      currency: this.#currency,
    };
  }

  toJSON(): MoneyValue {
    return this.toValue();
  }

  toString(): string {
    return `${this.#amount} ${this.#currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.#currency !== other.#currency) {
      throw PlatformError.validation(
        "money.currency-mismatch",
        "Money values with different currencies cannot be combined.",
        {
          leftCurrency: this.#currency,
          rightCurrency: other.#currency,
        },
      );
    }
  }

  private static assertValidAmount(amount: number): void {
    if (!Number.isSafeInteger(amount)) {
      throw Money.amountOutOfRange(amount);
    }
  }

  private static assertFiniteOperand(
    operand: number,
    name: string,
  ): void {
    if (!Number.isFinite(operand)) {
      throw PlatformError.validation(
        "money.invalid-operand",
        `Money ${name} must be a finite number.`,
        {
          operand,
          name,
        },
      );
    }
  }

  private static safeAdd(
    left: number,
    right: number,
  ): number {
    const result = left + right;

    if (!Number.isSafeInteger(result)) {
      throw Money.amountOutOfRange(result);
    }

    return result;
  }

  private static safeSubtract(
    left: number,
    right: number,
  ): number {
    const result = left - right;

    if (!Number.isSafeInteger(result)) {
      throw Money.amountOutOfRange(result);
    }

    return result;
  }

  private static amountOutOfRange(
    amount: number,
  ): PlatformError {
    return PlatformError.validation(
      "money.amount-out-of-range",
      "Money amount must be a safe integer expressed in the smallest currency unit.",
      { amount },
    );
  }
}

export function sumMoney(
  values: readonly Money[],
  currency: CurrencyCode = IRR.code,
): Money {
  return values.reduce(
    (total, value) => total.add(value),
    Money.zero(currency),
  );
}
