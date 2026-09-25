// src/app/api/auth/callback/route.ts
// Deferred — Supabase OAuth callback handler for cloud sync.
// V1 is local-first; authentication is a Nice-to-Have feature.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: 'Auth is not yet configured. V1 is local-first.' },
    { status: 501 }
  );
}
