import type {
  BackgroundJobExecutionContext,
} from "./background-job.ts";

export interface BackgroundJobHandler<
  TPayload = unknown,
> {
  readonly jobType: string;

  execute(
    payload: TPayload,
    context: BackgroundJobExecutionContext,
  ): Promise<void>;
}
