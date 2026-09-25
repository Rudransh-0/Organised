// src/lib/ai-extraction.ts

/**
 * Multi-provider AI extraction wrapper.
 * Tries Gemini first, falls back to Groq, returns 'unavailable' if both fail.
 *
 * V1 simplification: Rate-limit tracking (Upstash Redis) is deferred.
 * The reactive fallback (catch actual errors) is the full backstop.
 */

import { extractWithGemini } from '@/lib/providers/gemini';
import { extractWithGroq } from '@/lib/providers/groq';
import type { ExtractionResult } from '@/types';

export async function extractTasks(rawInput: string): Promise<ExtractionResult> {
  // Try Gemini first
  try {
    const tasks = await extractWithGemini(rawInput);
    return { status: 'success', tasks, provider: 'gemini' };
  } catch (geminiError) {
    console.error('[AI Extraction] Gemini failed:', geminiError);
  }

  // Fallback to Groq
  try {
    const tasks = await extractWithGroq(rawInput);
    return { status: 'success', tasks, provider: 'groq' };
  } catch (groqError) {
    console.error('[AI Extraction] Groq failed:', groqError);
  }

  // Both providers unavailable
  const geminiConfigured = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here';
  const groqConfigured = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here';

  if (!geminiConfigured && !groqConfigured) {
    return {
      status: 'unavailable',
      message: 'AI API keys not configured. Please add your GEMINI_API_KEY to .env.local to enable task extraction.',
    };
  }

  return {
    status: 'unavailable',
    message: "We're experiencing heavy traffic right now — please wait a moment and try again.",
  };
}
