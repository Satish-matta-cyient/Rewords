export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function todayIso(): string {
  return new Date().toISOString();
}
