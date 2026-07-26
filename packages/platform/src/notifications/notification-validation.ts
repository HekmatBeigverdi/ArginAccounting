import type {
  CreateNotificationRequest,
  NotificationAction,
  NotificationChannel,
  NotificationQuery,
  NotificationRecipient,
  NotificationSeverity,
} from "./notification.ts";

const supportedSeverities =
  new Set<NotificationSeverity>([
    "information",
    "success",
    "warning",
    "error",
  ]);

const supportedRecipientTypes = new Set([
  "user",
  "role",
  "branch",
  "company",
  "system",
]);

const supportedChannels =
  new Set<NotificationChannel>([
    "in-app",
    "email",
    "sms",
    "push",
  ]);

export interface NormalizedNotificationRequest {
  readonly notificationType: string;
  readonly recipient: NotificationRecipient;
  readonly title: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly channels: readonly NotificationChannel[];
  readonly actions: readonly NotificationAction[];
  readonly data?: Readonly<Record<string, unknown>>;
  readonly expiresAt?: Date;
  readonly correlationId?: string;
  readonly sourceModule?: string;
}

export function normalizeNotificationRequest(
  request: CreateNotificationRequest,
): NormalizedNotificationRequest {
  const notificationType =
    normalizeNotificationType(
      request.notificationType,
    );

  const sourceModule =
    normalizeOptionalModuleName(
      request.sourceModule,
    );

  if (
    sourceModule !== undefined &&
    !notificationType.startsWith(
      `${sourceModule}.`,
    )
  ) {
    throw new TypeError(
      `Notification type "${notificationType}" must ` +
      `use source module prefix "${sourceModule}".`,
    );
  }

  const severity =
    request.severity ?? "information";

  if (!supportedSeverities.has(severity)) {
    throw new TypeError(
      `Unsupported notification severity ` +
      `"${String(severity)}".`,
    );
  }

  const channels = normalizeChannels(
    request.channels,
  );
  const data = freezeRecord(request.data);
  const expiresAt = cloneOptionalDate(
    request.expiresAt,
    "expiresAt",
  );
  const correlationId = normalizeOptionalText(
    request.correlationId,
  );

  return Object.freeze({
    notificationType,
    recipient: normalizeRecipient(
      request.recipient,
    ),
    title: normalizeRequiredText(
      request.title,
      "title",
    ),
    message: normalizeRequiredText(
      request.message,
      "message",
    ),
    severity,
    channels,
    actions: normalizeActions(request.actions),
    ...(data === undefined ? {} : { data }),
    ...(expiresAt === undefined
      ? {}
      : { expiresAt }),
    ...(correlationId === undefined
      ? {}
      : { correlationId }),
    ...(sourceModule === undefined
      ? {}
      : { sourceModule }),
  });
}

export function normalizeNotificationQuery(
  query: NotificationQuery,
): NotificationQuery {
  const recipient = normalizeRecipient({
    recipientType: query.recipientType,
    recipientId: query.recipientId,
  });

  const limit = query.limit ?? 100;

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 1_000
  ) {
    throw new RangeError(
      "Notification query limit must be between 1 and 1000.",
    );
  }

  return Object.freeze({
    ...recipient,
    unreadOnly: query.unreadOnly ?? false,
    includeExpired:
      query.includeExpired ?? false,
    limit,
  });
}

export function normalizeNotificationId(
  notificationId: string,
): string {
  return normalizeRequiredText(
    notificationId,
    "notificationId",
  );
}

export function normalizeNotificationType(
  notificationType: string,
): string {
  const normalized =
    notificationType.trim();

  if (
    !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(
      normalized,
    )
  ) {
    throw new TypeError(
      "Notification type must use lowercase " +
      "module-prefixed dot-separated notation.",
    );
  }

  return normalized;
}

function normalizeRecipient(
  recipient: NotificationRecipient,
): NotificationRecipient {
  if (
    !supportedRecipientTypes.has(
      recipient.recipientType,
    )
  ) {
    throw new TypeError(
      `Unsupported notification recipient type ` +
      `"${String(recipient.recipientType)}".`,
    );
  }

  return Object.freeze({
    recipientType: recipient.recipientType,
    recipientId: normalizeRequiredText(
      recipient.recipientId,
      "recipient.recipientId",
    ),
  });
}

function normalizeChannels(
  channels:
    | readonly NotificationChannel[]
    | undefined,
): readonly NotificationChannel[] {
  const values =
    channels === undefined
      ? ["in-app"] as const
      : channels;

  if (values.length === 0) {
    throw new TypeError(
      "Notification must define at least one channel.",
    );
  }

  const normalized: NotificationChannel[] = [];

  for (const channel of values) {
    if (!supportedChannels.has(channel)) {
      throw new TypeError(
        `Unsupported notification channel ` +
        `"${String(channel)}".`,
      );
    }

    if (!normalized.includes(channel)) {
      normalized.push(channel);
    }
  }

  return Object.freeze(normalized);
}

function normalizeActions(
  actions:
    | readonly NotificationAction[]
    | undefined,
): readonly NotificationAction[] {
  if (actions === undefined) {
    return Object.freeze([]);
  }

  const actionIds = new Set<string>();

  const normalized = actions.map((action) => {
    const actionId = normalizeActionId(
      action.actionId,
    );

    if (actionIds.has(actionId)) {
      throw new TypeError(
        `Notification action "${actionId}" is duplicated.`,
      );
    }

    actionIds.add(actionId);

    const url = normalizeOptionalText(
      action.url,
    );

    const commandName = normalizeOptionalText(
      action.commandName,
    );

    if (
      url === undefined &&
      commandName === undefined
    ) {
      throw new TypeError(
        `Notification action "${actionId}" must ` +
        "define url or commandName.",
      );
    }

    const parameters = freezeRecord(
      action.parameters,
    );

    return Object.freeze({
      actionId,
      label: normalizeRequiredText(
        action.label,
        `actions.${actionId}.label`,
      ),
      ...(url === undefined ? {} : { url }),
      ...(commandName === undefined
        ? {}
        : { commandName }),
      ...(parameters === undefined
        ? {}
        : { parameters }),
    });
  });

  return Object.freeze(normalized);
}

function normalizeActionId(
  actionId: string,
): string {
  const normalized = actionId.trim();

  if (!/^[a-z][a-z0-9-]*$/.test(normalized)) {
    throw new TypeError(
      "Notification actionId must use lowercase kebab-case notation.",
    );
  }

  return normalized;
}

function normalizeOptionalModuleName(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  if (!/^[a-z][a-z0-9-]*$/.test(normalized)) {
    throw new TypeError(
      "Notification sourceModule must use lowercase notation.",
    );
  }

  return normalized;
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `Notification ${fieldName} must not be empty.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0
    ? undefined
    : normalized;
}

function cloneOptionalDate(
  value: Date | undefined,
  fieldName: string,
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Number.isNaN(value.getTime())) {
    throw new TypeError(
      `Notification ${fieldName} must be a valid date.`,
    );
  }

  return new Date(value.getTime());
}

function freezeRecord(
  value:
    | Readonly<Record<string, unknown>>
    | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Object.freeze({
    ...value,
  });
}
