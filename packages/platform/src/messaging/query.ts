export interface Query<
  TResult = unknown,
  TQueryType extends string = string,
> {
  readonly queryType: TQueryType;
  readonly __resultType?: TResult;
}

export interface QueryHandler<
  TQuery extends Query<TResult>,
  TResult,
> {
  handle(query: TQuery): Promise<TResult> | TResult;
}

export type QueryHandlerFunction<
  TQuery extends Query<TResult>,
  TResult,
> = (
  query: TQuery,
) => Promise<TResult> | TResult;

export interface QueryBus {
  ask<
    TResult,
    TQuery extends Query<TResult> = Query<TResult>,
  >(
    query: TQuery,
  ): Promise<TResult>;
}
