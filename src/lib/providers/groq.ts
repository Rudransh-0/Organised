// src/lib/providers/groq.ts
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

export async function extractWithGroq(rawInput: string): Promise<AIExtractedTask[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') throw new Error('GROQ_API_KEY not configured');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: rawInput },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    throw new Error(`Groq API error: ${status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseAndNormalize(text);
}

function parseAndNormalize(responseText: string): AIExtractedTask[] {
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed = JSON.parse(cleaned);

  // Groq with json_object mode sometimes wraps in { "tasks": [...] }
  if (!Array.isArray(parsed) && parsed.tasks && Array.isArray(parsed.tasks)) {
    parsed = parsed.tasks;
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Groq response is not an array');
  }

  return parsed.map((item: Record<string, unknown>) => ({
    title: String(item.title ?? ''),
    category: String(item.category ?? ''),
    raw_segment: String(item.raw_segment ?? ''),
  })).filter((t: AIExtractedTask) => t.title.length > 0);
}
