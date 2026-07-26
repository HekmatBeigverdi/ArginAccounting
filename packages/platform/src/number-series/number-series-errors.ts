import { PlatformError } from "../common/index.ts";

export class NumberSeriesDefinitionNotFoundError
  extends PlatformError {
  readonly seriesType: string;

  constructor(seriesType: string) {
    super({
      code: "number-series.definition-not-found",
      message:
        `No number series definition is registered for ` +
        `"${seriesType}".`,
      category: "not-found",
      details: {
        seriesType,
      },
    });

    this.name = "NumberSeriesDefinitionNotFoundError";
    this.seriesType = seriesType;
  }
}

export class DuplicateNumberSeriesDefinitionError
  extends PlatformError {
  readonly seriesType: string;

  constructor(seriesType: string) {
    super({
      code: "number-series.duplicate-definition",
      message:
        `A number series definition is already registered for ` +
        `"${seriesType}".`,
      category: "conflict",
      details: {
        seriesType,
      },
    });

    this.name = "DuplicateNumberSeriesDefinitionError";
    this.seriesType = seriesType;
  }
}

export class NumberSeriesOverflowError
  extends PlatformError {
  readonly seriesType: string;
  readonly currentValue: number;
  readonly incrementBy: number;

  constructor(
    seriesType: string,
    currentValue: number,
    incrementBy: number,
  ) {
    super({
      code: "number-series.overflow",
      message:
        `The next value for number series ` +
        `"${seriesType}" exceeds the safe integer range.`,
      category: "infrastructure",
      details: {
        seriesType,
        currentValue,
        incrementBy,
      },
    });

    this.name = "NumberSeriesOverflowError";
    this.seriesType = seriesType;
    this.currentValue = currentValue;
    this.incrementBy = incrementBy;
  }
}
