/** Calendar values are UTC-midnight wire strings, never converted through the device timezone. */
export function toCalendarDate(date: Date): string {
  return `${date.toISOString().slice(0, 10)}T00:00:00Z`;
}

export function getTodayCalendarDate(): string {
  return toCalendarDate(new Date());
}

export function formatCalendarDate(value: string): string {
  return value ? value.slice(0, 10) : "";
}
