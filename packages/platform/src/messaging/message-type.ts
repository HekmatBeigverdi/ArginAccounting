export function normalizeMessageType(
  messageType: string,
  messageKind: "command" | "query",
): string {
  const normalized = messageType.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `${capitalize(messageKind)} type must not be empty.`,
    );
  }

  if (
    !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/.test(
      normalized,
    )
  ) {
    throw new TypeError(
      `${capitalize(messageKind)} type must use ` +
      "lowercase dot-separated notation.",
    );
  }

  return normalized;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
