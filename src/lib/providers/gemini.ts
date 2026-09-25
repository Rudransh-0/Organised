// src/lib/providers/gemini.ts
import { GoogleGenAI } from '@google/genai';
import type { AIExtractedTask } from '@/types';

const EXTRACTION_PROMPT = `You are a task extraction engine. The user will give you a messy, stream-of-consciousness brain dump. Your job is to:

1. Segment the input into distinct, individual tasks
2. For each task, provide:
   - "title": A clean, concise task title (imperative form, e.g. "Do laundry")
   - "category": A short category label (e.g. "Personal", "Work", "Health", "Errands", "Finance", "Social")
   - "raw_segment": The EXACT substring from the original input that this task was extracted from. This must be a verbatim copy of the relevant portion of the input text.

CRITICAL RULES:
- Do NOT extract or assign due dates. That is handled separately.
- Do NOT invent tasks that aren't in the input.
- The "raw_segment" must be an exact substring of the original input — do not paraphrase or modify it.
- Return ONLY valid JSON. No markdown fencing, no explanation, no prose.

Return format: an array of objects:
[
  { "title": "...", "category": "...", "raw_segment": "..." }
]

If the input contains no actionable tasks, return an empty array: []`;

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
];

export async function extractWithGemini(rawInput: string): Promise<AIExtractedTask[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') throw new Error('GEMINI_API_KEY not configured');

  const ai = new GoogleGenAI({ apiKey });

  let lastError: unknown;
  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `${EXTRACTION_PROMPT}\n\nUser input:\n"${rawInput}"`,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = response.text ?? '';
      return parseAndNormalize(text);
    } catch (err) {
      console.warn(`[Gemini Provider] Model ${model} failed, trying next:`, err);
      lastError = err;
    }
  }

  throw lastError ?? new Error('All Gemini models failed');
}

function parseAndNormalize(responseText: string): AIExtractedTask[] {
  // Strip any markdown fencing if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response is not an array');
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title ?? ''),
    category: String(item.category ?? ''),
    raw_segment: String(item.raw_segment ?? ''),
  })).filter((t: AIExtractedTask) => t.title.length > 0);
}
