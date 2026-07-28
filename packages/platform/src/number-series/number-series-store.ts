export interface ReserveNumberInput {
  readonly counterKey: string;
  readonly seriesType: string;
  readonly initialValue: number;
  readonly incrementBy: number;
}

export interface NumberSeriesStore {
  reserveNext(
    input: ReserveNumberInput,
  ): Promise<number>;
}
