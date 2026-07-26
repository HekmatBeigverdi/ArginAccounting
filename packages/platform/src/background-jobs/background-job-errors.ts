export class DuplicateBackgroundJobError
  extends Error {
  readonly code =
    "background-job.duplicate" as const;

  constructor(
    readonly jobId: string,
  ) {
    super(
      `Background job "${jobId}" is already registered.`,
    );

    this.name = "DuplicateBackgroundJobError";
  }
}

export class DuplicateBackgroundJobHandlerError
  extends Error {
  readonly code =
    "background-job.handler-duplicate" as const;

  constructor(
    readonly jobType: string,
  ) {
    super(
      `A handler for background job type "${jobType}" is already registered.`,
    );

    this.name =
      "DuplicateBackgroundJobHandlerError";
  }
}

export class BackgroundJobHandlerNotFoundError
  extends Error {
  readonly code =
    "background-job.handler-not-found" as const;

  constructor(
    readonly jobType: string,
  ) {
    super(
      `No handler is registered for background job type "${jobType}".`,
    );

    this.name =
      "BackgroundJobHandlerNotFoundError";
  }
}

export class BackgroundJobNotFoundError
  extends Error {
  readonly code =
    "background-job.not-found" as const;

  constructor(
    readonly jobId: string,
  ) {
    super(
      `Background job "${jobId}" was not found.`,
    );

    this.name = "BackgroundJobNotFoundError";
  }
}

export class InvalidBackgroundJobTransitionError
  extends Error {
  readonly code =
    "background-job.invalid-transition" as const;

  constructor(
    readonly jobId: string,
    readonly currentStatus: string,
    readonly requestedStatus: string,
  ) {
    super(
      `Background job "${jobId}" cannot transition ` +
      `from "${currentStatus}" to "${requestedStatus}".`,
    );

    this.name =
      "InvalidBackgroundJobTransitionError";
  }
}
