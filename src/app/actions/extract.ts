// src/app/actions/extract.ts
'use server';

import { extractTasks } from '@/lib/ai-extraction';
import type { ExtractionResult } from '@/types';

export async function extractAction(rawInput: string): Promise<ExtractionResult> {
  if (!rawInput || rawInput.trim().length === 0) {
    return { status: 'unavailable', message: 'Please enter some text first.' };
  }

  return extractTasks(rawInput.trim());
}
