export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
export function endOfDay(d: Date = new Date()): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
export function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
export function hoursBetween(a: Date, b: Date = new Date()): number {
  return Math.abs(b.getTime() - a.getTime()) / 3_600_000;
}
export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
/** Builds a zero-filled daily series so charts never have gaps. */
export function dailySeries(from: Date, to: Date): { label: string; date: Date }[] {
  const out: { label: string; date: Date }[] = [];
  const cursor = startOfDay(from);
  while (cursor <= to) {
    out.push({ label: dayKey(cursor), date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
