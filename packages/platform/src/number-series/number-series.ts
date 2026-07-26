import type { NumberSeriesScope } from "./number-series-scope.ts";

export interface NumberSeriesDefinition {
  readonly seriesType: string;
  readonly initialValue?: number;
  readonly incrementBy?: number;
  readonly padding?: number;
  readonly prefix?: string;
  readonly suffix?: string;
}

export interface NumberSeriesRequest {
  readonly seriesType: string;
  readonly scope: NumberSeriesScope;
}

export interface GeneratedNumber {
  readonly seriesType: string;
  readonly scope: NumberSeriesScope;
  readonly sequence: number;
  readonly formattedValue: string;
}

export interface NumberSeries {
  next(
    request: NumberSeriesRequest,
  ): Promise<GeneratedNumber>;
}
