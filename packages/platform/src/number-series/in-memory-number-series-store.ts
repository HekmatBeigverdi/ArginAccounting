import { NumberSeriesOverflowError } from "./number-series-errors.ts";
import type {
  NumberSeriesStore,
  ReserveNumberInput,
} from "./number-series-store.ts";

export class InMemoryNumberSeriesStore
  implements NumberSeriesStore {
  readonly #currentValues = new Map<string, number>();

  async reserveNext(
    input: ReserveNumberInput,
  ): Promise<number> {
    const currentValue = this.#currentValues.get(
      input.counterKey,
    );

    if (currentValue === undefined) {
      this.#currentValues.set(
        input.counterKey,
        input.initialValue,
      );

      return input.initialValue;
    }

    const nextValue =
      currentValue + input.incrementBy;

    if (!Number.isSafeInteger(nextValue)) {
      throw new NumberSeriesOverflowError(
        input.seriesType,
        currentValue,
        input.incrementBy,
      );
    }

    this.#currentValues.set(
      input.counterKey,
      nextValue,
    );

    return nextValue;
  }

  getCurrentValue(
    counterKey: string,
  ): number | undefined {
    return this.#currentValues.get(counterKey);
  }

  clear(): void {
    this.#currentValues.clear();
  }

  get counterCount(): number {
    return this.#currentValues.size;
  }
}
