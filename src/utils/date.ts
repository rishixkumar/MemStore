import { format, isToday, isYesterday } from 'date-fns';

export type Timestamped = {
  timestamp: number;
};

export type SectionedItems<T> = {
  title: string;
  data: T[];
};

export function toLocalDateKey(timestamp: number): string {
  return format(new Date(timestamp), 'yyyy-MM-dd');
}

export function getDayRangeForDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
}

export function getDaysAgoRange(daysAgo: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getRelativeDayLabel(timestamp: number) {
  const date = new Date(timestamp);
  if (isToday(date)) return 'TODAY';
  if (isYesterday(date)) return 'YESTERDAY';
  return format(date, 'MMMM d').toUpperCase();
}

export function groupItemsByDay<T extends Timestamped>(items: T[]): SectionedItems<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getRelativeDayLabel(item.timestamp);
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

export function formatMemoryDateTime(timestamp: number) {
  return format(new Date(timestamp), 'MMM d, yyyy · h:mm a');
}

export function formatMemoryTime(timestamp: number) {
  return format(new Date(timestamp), 'h:mm a');
}
