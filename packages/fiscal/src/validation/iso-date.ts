const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

export function compareIsoDates(
  first: string,
  second: string
): number {
  return first.localeCompare(second);
}

export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string
): boolean {
  return (
    compareIsoDates(date, startDate) >= 0 &&
    compareIsoDates(date, endDate) <= 0
  );
}
