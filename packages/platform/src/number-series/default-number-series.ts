import {
  DuplicateNumberSeriesDefinitionError,
  NumberSeriesDefinitionNotFoundError,
} from "./number-series-errors.ts";
import {
  createNumberSeriesScopeKey,
} from "./number-series-scope.ts";
import type {
  GeneratedNumber,
  NumberSeries,
  NumberSeriesDefinition,
  NumberSeriesRequest,
} from "./number-series.ts";
import type {
  NumberSeriesStore,
} from "./number-series-store.ts";
import {
  normalizeNumberSeriesDefinition,
  normalizeSeriesType,
  type NormalizedNumberSeriesDefinition,
} from "./number-series-validation.ts";

export class DefaultNumberSeries
  implements NumberSeries {
  readonly #definitions =
    new Map<
      string,
      NormalizedNumberSeriesDefinition
    >();

  constructor(
    private readonly store: NumberSeriesStore,
    definitions:
      readonly NumberSeriesDefinition[] = [],
  ) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(
    definition: NumberSeriesDefinition,
  ): void {
    const normalized =
      normalizeNumberSeriesDefinition(definition);

    if (
      this.#definitions.has(normalized.seriesType)
    ) {
      throw new DuplicateNumberSeriesDefinitionError(
        normalized.seriesType,
      );
    }

    this.#definitions.set(
      normalized.seriesType,
      normalized,
    );
  }

  hasDefinition(seriesType: string): boolean {
    return this.#definitions.has(
      seriesType.trim(),
    );
  }

  getDefinition(
    seriesType: string,
  ): NormalizedNumberSeriesDefinition | undefined {
    return this.#definitions.get(
      seriesType.trim(),
    );
  }

  async next(
    request: NumberSeriesRequest,
  ): Promise<GeneratedNumber> {
    const seriesType = normalizeSeriesType(
      request.seriesType,
    );

    const definition =
      this.#definitions.get(seriesType);

    if (definition === undefined) {
      throw new NumberSeriesDefinitionNotFoundError(
        seriesType,
      );
    }

    const scopeKey = createNumberSeriesScopeKey(
      request.scope,
    );

    const counterKey =
      `${seriesType}|${scopeKey}`;

    const sequence = await this.store.reserveNext({
      counterKey,
      seriesType,
      initialValue: definition.initialValue,
      incrementBy: definition.incrementBy,
    });

    return {
      seriesType,
      scope: {
        ...request.scope,
      },
      sequence,
      formattedValue:
        this.formatValue(definition, sequence),
    };
  }

  get definitionCount(): number {
    return this.#definitions.size;
  }

  private formatValue(
    definition: NormalizedNumberSeriesDefinition,
    sequence: number,
  ): string {
    const numericPart =
      sequence.toString().padStart(
        definition.padding,
        "0",
      );

    return (
      definition.prefix +
      numericPart +
      definition.suffix
    );
  }
}
