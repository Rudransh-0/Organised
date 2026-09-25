// src/app/actions/transcribe.ts
'use server';

import { GoogleGenAI } from '@google/genai';

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
];

export async function transcribeAudioAction(
  base64Audio: string,
  mimeType: string = 'audio/wav'
): Promise<{ success: boolean; text?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Normalize mimeType for Google GenAI
  const cleanMimeType = mimeType.split(';')[0].trim();

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: base64Audio,
            },
          },
          'Transcribe this spoken audio verbatim into text. Return ONLY the transcribed words with standard punctuation. Do not include commentary, notes, or preamble.',
        ],
      });

      const text = response.text?.trim() ?? '';
      return { success: true, text };
    } catch (err: any) {
      console.warn(`[Transcribe Audio] Model ${model} failed:`, err?.status, err?.message);
    }
  }

  return { success: false, error: 'Audio transcription failed' };
}
