export function normalizeUsername(
  username: string
): string {
  return username.trim().toLocaleUpperCase("en-US");
}

export function normalizeRoleCode(
  code: string
): string {
  return code.trim().toLocaleUpperCase("en-US");
}
