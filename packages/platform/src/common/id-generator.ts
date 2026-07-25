export interface IdGenerator {
  generate(): string;
}

interface CryptoWithRandomUuid {
  randomUUID(): string;
}

export class UuidGenerator implements IdGenerator {
  generate(): string {
    const webCrypto = (
      globalThis as typeof globalThis & {
        readonly crypto: CryptoWithRandomUuid;
      }
    ).crypto;

    return webCrypto.randomUUID();
  }
}

export class SequenceIdGenerator implements IdGenerator {
  readonly #prefix: string;
  #nextValue: number;

  constructor(prefix = "test", initialValue = 1) {
    if (!Number.isSafeInteger(initialValue) || initialValue < 0) {
      throw new RangeError(
        "SequenceIdGenerator initial value must be a non-negative safe integer.",
      );
    }

    this.#prefix = prefix;
    this.#nextValue = initialValue;
  }

  generate(): string {
    const id = `${this.#prefix}-${this.#nextValue}`;
    this.#nextValue += 1;

    return id;
  }
}
