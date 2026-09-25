// src/app/api/transcribe/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
];

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let base64Audio = '';
    let mimeType = 'audio/wav';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audio') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No audio file provided' }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      base64Audio = Buffer.from(arrayBuffer).toString('base64');
      mimeType = file.type || 'audio/wav';
    } else {
      const body = await req.json();
      base64Audio = body.audio || '';
      mimeType = body.mimeType || 'audio/wav';
    }

    if (!base64Audio) {
      return NextResponse.json({ success: false, error: 'Empty audio data' }, { status: 400 });
    }

    // 1. Try Groq Whisper if key is provided
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey !== 'your_groq_api_key_here') {
      try {
        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const whisperFormData = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: mimeType });
        whisperFormData.append('file', audioBlob, 'speech.wav');
        whisperFormData.append('model', 'whisper-large-v3-turbo');
        whisperFormData.append('response_format', 'json');

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
          },
          body: whisperFormData,
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const text = (groqData.text || '').trim();
          if (text) {
            return NextResponse.json({ success: true, text, provider: 'groq-whisper' });
          }
        }
      } catch (groqErr) {
        console.warn('[Transcribe API] Groq Whisper fallback attempt failed:', groqErr);
      }
    }

    // 2. Transcribe with Gemini
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const cleanMimeType = mimeType.split(';')[0].trim();

    let lastError = '';
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
            'Transcribe this spoken audio verbatim into text. Return ONLY the transcribed words with standard punctuation. Do not include commentary, notes, timestamps, or preamble. If the audio is silent or unintelligible, return an empty string.',
          ],
        });

        let text = response.text?.trim() ?? '';
        // Filter out timestamp-only responses (e.g. "00:01" or empty)
        if (/^\d{2}:\d{2}$/.test(text)) {
          text = '';
        }

        return NextResponse.json({ success: true, text, provider: `gemini-${model}` });
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`[Transcribe API] Model ${model} failed:`, lastError);
      }
    }

    return NextResponse.json(
      { success: false, error: `All transcription models failed: ${lastError}` },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('[Transcribe API] Unexpected error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
