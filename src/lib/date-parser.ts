// src/lib/date-parser.ts

/**
 * Client-side date parsing using chrono-node.
 * Takes a task's raw_segment and the browser's local Date,
 * returns a UTC ISO due_date or null.
 *
 * The browser's local clock and timezone are used implicitly —
 * no explicit timezone detection step needed.
 */

import * as chrono from 'chrono-node';

export function parseDueDate(rawSegment: string): string | null {
  const referenceDate = new Date();
  const results = chrono.parse(rawSegment, referenceDate, { forwardDate: true });

  if (results.length === 0) return null;

  // Take the first (most relevant) parsed date
  const parsed = results[0].start.date();
  return parsed.toISOString();
}
