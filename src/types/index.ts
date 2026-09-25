// src/types/index.ts

export type UrgencyColumn = 'Urgent' | 'Upcoming' | 'Backlog' | 'Undefined';

export interface Task {
  id: string;
  raw_input: string;
  title: string;
  category: string;
  urgency_column: UrgencyColumn;
  urgency_pinned: boolean;
  due_date: string | null; // ISO 8601 UTC
  created_at: string; // ISO 8601 UTC
}

/** Shape returned by AI providers after normalization */
export interface AIExtractedTask {
  title: string;
  category: string;
  raw_segment: string;
}

/** Result from the AI extraction server action */
export type ExtractionResult =
  | { status: 'success'; tasks: AIExtractedTask[]; provider: 'gemini' | 'groq' }
  | { status: 'unavailable'; message: string };

/** Category-to-color mapping */
export interface CategoryColor {
  category: string;
  color: string;
}
