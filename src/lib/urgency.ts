// src/lib/urgency.ts
import type { UrgencyColumn } from '@/types';

/**
 * Deterministic urgency column computation from due_date.
 * This is the SINGLE source of truth — never duplicate this logic elsewhere.
 *
 * Rules:
 * - due_date is today, tomorrow, or the day after → Urgent
 * - due_date is further out than that → Upcoming
 * - due_date is in the past → Backlog
 * - due_date is null → Undefined
 *
 * Compares against the viewer's local calendar day (browser clock).
 */
export function computeUrgencyColumn(dueDate: string | null): UrgencyColumn {
  if (dueDate === null) return 'Undefined';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Backlog';
  if (diffDays <= 2) return 'Urgent'; // today, tomorrow, day after
  return 'Upcoming';
}
