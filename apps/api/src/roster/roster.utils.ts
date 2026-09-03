/** Parse HH:mm (24h) to a UTC time-only Date for @db.Time columns. */
export function parseTimeString(value: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid time format "${value}", expected HH:mm`);
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid time "${value}"`);
  }
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
}

/** Format @db.Time Date to HH:mm. */
export function formatTimeValue(value: Date): string {
  return value.toISOString().slice(11, 16);
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date "${value}", expected YYYY-MM-DD`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function eachDateInRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
