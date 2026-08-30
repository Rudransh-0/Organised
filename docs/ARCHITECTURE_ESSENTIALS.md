# Architecture Essentials — Organised

Fast-reference for AI coding agents. This covers every critical decision needed to implement correctly. It is standalone — you should not need ARCHITECTURE.md for day-to-day work. Consult the full ARCHITECTURE.md only for deployment/CI, monitoring, or testing-framework detail, none of which is covered here.

## Hard Constraints (do not violate)

- **$0 infrastructure.** Free-tier AI providers only (Gemini primary, Groq secondary — see below). No paid AI models, ever, on any provider in the chain. Upstash Redis (rate-limit tracking) must also stay within its free tier.
- **No native apps.** Web only (Next.js, Vercel).
- **No recurring tasks, no project hierarchies.** Flat task list only.
- **Account-less by default.** The app must be fully usable with zero login. Login is optional, not gating.

## Tech Stack

Next.js (App Router) · React · Tailwind CSS · Supabase (Auth + Postgres, free tier) · Google Gemini API (free tier, primary AI provider) · Groq API running `openai/gpt-oss-120b` (free tier, fallback AI provider) · `chrono-node` (deterministic client-side date parsing) · Upstash Redis via Vercel Marketplace integration (free tier, proactive rate-limit tracking) · Vercel deployment.

## AI Provider Chain

- **Gemini is primary.** It segments the raw input more reliably than the fallback model, so it's always tried first.
- **Groq (`openai/gpt-oss-120b`) is the sole fallback**, used only when Gemini is unavailable or its rate limit is at/near capacity.
- **No third AI-based fallback tier.** If both providers are exhausted, the app shows a "heavy traffic, try again shortly" message and preserves the user's raw input for retry. It does **not** degrade to a local rule-based extraction — a worse-quality result was explicitly rejected in favor of an honest failure state.
- Both providers are called through the same interface and must return the same normalized shape (see Task Schema below) — provider-specific response quirks (extra prose, reasoning blocks, differing JSON syntax) must be stripped/parsed at the adapter layer, never leaked to the caller.
- **Neither provider extracts `due_date` anymore.** Their only job is segmentation, `title`, `category`, and `raw_segment` (see below). Date extraction is fully deterministic client-side logic (see Timezone / date resolution).
- **Rate-limit numbers used for proactive skipping:**
  - Groq (`openai/gpt-oss-120b`): 30 requests/min, 1,000 requests/day, 8K tokens/min, 200K tokens/day.
  - Gemini free-tier limits: **not independently verified in this document — confirm current published RPM/RPD/TPM figures against Google AI Studio before implementing the proactive-skip thresholds.** Do not hardcode a guessed number.

## Data Flow (one-way to remember it)

```
Client input (voice/text)
  → AI provider chain (Server Action: Gemini → Groq fallback)
      → returns array of { title, category, raw_segment } per task — NO due_date
  → client-side: chrono-node parses due_date from each task's raw_segment,
      resolved against the browser's own local Date (no server round-trip needed for this step)
  → assembled Task objects written to localStorage (source of truth, always)
  → if logged in: background sync to Supabase (non-blocking, optimistic)
```

localStorage is authoritative for anonymous users. For authenticated users it's still the immediate write target — Supabase is always synced *to* in the background, never blocked on.

**If both AI providers fail or are proactively skipped due to exhausted quota:** the Server Action returns an explicit "unavailable" state. The client shows a "heavy traffic, please try again shortly" message and leaves the user's raw input in the input box unchanged. No task is created, nothing is written to localStorage, and no partial/degraded task is fabricated.

**`client_timestamp` and `client_timezone` are no longer sent to any AI provider.** They were previously required for the AI to resolve relative dates — that job has moved entirely to client-side `chrono-node`, which uses the browser's own local `Date` object directly. There is no cross-device or cross-request transmission of timezone data at all anymore; each device resolves its own dates locally, every time.

## Task Schema

```typescript
interface Task {
  id: string;                    // UUID v4, client-generated
  user_id?: string;               // null for anonymous; auth.uid() once synced
  raw_input: string;              // original full user text, immutable after creation
  raw_segment: string;            // the exact substring of raw_input the AI provider attributed to THIS task; used only by client-side chrono-node to resolve this task's own due_date at creation, then dropped — not retained in localStorage, not displayed, not editable, never synced.
  title: string;                  // AI-generated
  category: string;               // AI-generated; cosmetic only — drives card color accent, NOT a structural column
  urgency_column: 'Urgent' | 'Upcoming' | 'Backlog' | 'Undefined'; // NOT AI-assigned. Authoritative only when urgency_pinned is true — otherwise stale by design, see rule below
  urgency_pinned: boolean;        // true once user manually moves the card; permanently exempts it from auto-recompute
  due_date: string | null;        // ISO 8601 UTC. Computed client-side by chrono-node from raw_segment, NOT by any AI provider.
  created_at: string;             // ISO 8601 UTC, server-assigned
  field_updated_at: {              // per-field timestamps, server-assigned at write time — this is the ONLY source of truth for conflict resolution
    title: string;
    category: string;
    urgency_column: string;       // covers urgency_pinned too — they always change together
    due_date: string;
  };
  synced?: boolean;               // client-only; also distinguishes "not yet pushed" from "deleted upstream" (see deletion rule below)
}
```
**No `is_completed` field.** Completing a task deletes it (see below) — it never gets flagged, so a persisted boolean that can only ever be `false` is dead weight and was removed.

**`raw_segment` is not synced to Supabase, and is not retained locally past creation either.** It's a transient extraction artifact needed only once, to compute `due_date` at creation time — nothing downstream (including `urgency_column` recompute, which only ever reads `due_date`) ever needs it again. Drop it from the local `Task` object immediately after `due_date` is computed; do not persist it in localStorage and do not sync it to Supabase.

## Critical Business Rules

**Urgency columns**
- Exactly four, fixed: `Urgent`, `Upcoming`, `Backlog`, `Undefined`. Never invent a new one.
- **Not AI-assigned, and no longer even indirectly AI-derived.** The column is computed deterministically by a shared pure function (`src/lib/urgency.ts`) from `due_date` and the viewer's local calendar day — this is a fixed rule, not a judgment call:
  - `due_date` is today, tomorrow, or the day after → `Urgent`
  - `due_date` is further out than that → `Upcoming`
  - `due_date` is in the past → `Backlog` (no completion check — completed tasks are deleted, so any surviving task is inherently incomplete)
  - `due_date` is `null` → `Undefined`
- **This recomputes on every render** for any task where `urgency_pinned` is `false` — a task keeps advancing columns automatically as its due date approaches or passes.
- A manual tap-and-hold move sets `urgency_pinned = true` and **permanently** exempts that task from auto-recompute from then on. This is a one-way switch; there is no "unpin." A pinned task shows a small pin indicator on its card at all times, so users can visually distinguish locked-in-place tasks from ones still auto-tracking their due date.
- Because this is computed against the *viewer's* local calendar day, it depends on the browser's own local clock at render time — same mechanism `chrono-node` uses for date extraction, but they are separate calls; nothing is shared or cached between them.

**Task completion & deletion**
- Long-press (mobile) or right-click (desktop) on a card triggers three things at once: the four urgency columns highlight as tappable move-targets, a small "..." icon appears (opens the edit menu), and a small green checkmark icon appears (direct Mark Complete, no submenu). This replaces the earlier single-popup-with-five-options design.
- Moving a task is highlight-then-tap: tapping a highlighted column moves the card there. Not drag-and-drop.
- Tapping the green checkmark removes the task from the board and from `localStorage` **immediately**, for both anonymous and logged-in users — no distinction.
- It's not actually gone yet: held in an **in-memory-only** pending-deletion buffer for 5–10s with an "Undo" toast. Undo restores it exactly as it was, nothing was ever sent to the server. Reloading the page during this window loses the undo option — accepted V1 limitation.
- If the window expires: for logged-in users, a background `DELETE` fires to Supabase (retried on reconnect if offline, like any other background sync call). Anonymous users have nothing further to do.
- **Deletion always beats a pending edit.** If another device has an unsynced edit on a task that gets completed elsewhere, the edit is discarded once that device syncs — no merge attempt.
- **Deletion propagates on next pull, not instantly.** A task deleted upstream disappears from another device on its next full reconciliation pull (login, or any app open while authenticated). Rule: a local task flagged `synced: true` that's missing from a fresh pull = deleted upstream, remove it locally. A task never pushed (`synced` false/absent) is never removed this way.
- A task still inside its undo window counts as an "unsynced change" for the logout warning dialog.

**Task editing**
- The "..." icon (same long-press/right-click gesture as above) opens an edit menu covering `title` (free text), `category` (free text — matches category's existing free-form, AI-generated nature; not a fixed dropdown), and `due_date`.
- `due_date` is edited exclusively via a date picker, never free text. The picker either returns a valid date or nothing — there is no way to submit an unparseable value. An explicit "Clear date" action sets `due_date` back to `null`, which puts the task in `Undefined`, same as if the AI never found a date at creation.
- Editing `due_date` on an unpinned task can visibly move it to a different urgency column the moment the edit is saved — this is intended, not a bug: `urgency_column` always recomputes live from the current `due_date` for unpinned tasks, and an edit is no exception.
- Every edited field writes a fresh server-assigned timestamp into that field's entry in `field_updated_at`, exactly like any AI-generated field would at creation. No new conflict-resolution logic is needed — the existing per-field last-write-wins sync engine already handles this by design.
- Editing a field does not itself set `urgency_pinned`. Only a manual column move does that (see above). A user can freely edit `due_date` on an unpinned task and watch it keep auto-tracking afterward.

**Categories**
- AI-generated, free-form, but purely visual (color accent on card + legend). Never render as a column or filter structure — that's `urgency_column`'s job only. User edits to `category` are also free-form text, consistent with this.

**Timezone / date resolution — now fully client-side, no AI, no server round-trip**
- `chrono-node` parses each task's `due_date` from its `raw_segment`, resolved against `new Date()` in the user's own browser — the browser's local clock and timezone are used implicitly; there is no explicit `Intl.DateTimeFormat().resolvedOptions().timeZone` detection step needed for this purpose anymore, since `chrono-node` consumes a native local `Date` object directly.
- The result is converted to UTC (`.toISOString()`) before being written into the `Task` object.
- Neither `client_timestamp` nor `client_timezone` is sent to any Server Action or AI provider anymore — this data never leaves the browser for date-resolution purposes. (Flag if any other feature is later found to need timezone info server-side; as of this revision, nothing does.)
- This still runs fresh, per-device, every time a task is created — same cross-device correctness guarantee as before, just achieved locally instead of via a server round-trip.

**AI provider fallback chain**
- Gemini is tried first for every extraction request.
- Before calling Gemini, the Server Action checks a proactive rate-limit counter (Upstash Redis) for Gemini's current per-minute usage. If Gemini is at or near its limit, the call is skipped and Groq is tried directly — this avoids wasting a request/latency cycle on a call likely to fail.
- If Gemini is attempted and fails (429, 5xx, timeout, or malformed response that fails schema validation), Groq (`openai/gpt-oss-120b`) is tried as the reactive fallback, regardless of what the proactive counter said.
- The same proactive-check-then-reactive-fallback pattern applies to Groq before falling through to the "unavailable" state.
- **Rate-limit tracking must fail open.** If Upstash Redis is unreachable, misconfigured, or errors for any reason, the Server Action must treat quota as available and proceed to call the real provider as normal — a genuine 429 from the provider itself is still caught by the reactive fallback as a backstop. Redis being down must never, by itself, cause task creation to fail. This is a hard rule, not a nice-to-have — an availability dependency on Redis for a feature Redis is only meant to optimize (not gate) would be a regression, not an improvement.
- Both providers' raw responses (including malformed/prose-wrapped output) must be normalized to the same `{ title, category, raw_segment }[]` shape by a provider-specific adapter before returning to the caller. Never let provider-specific response quirks leak past the adapter layer.

**Voice input**
- Not on-device — it's a network call to the browser vendor's speech service. Assume it can fail. Three failure states must be handled independently, each falling back to text input: unsupported browser, denied mic permission, failed/empty recognition. Never let any of them throw unhandled.

**Sync & conflict resolution (only relevant once login exists)**
- First login: local tasks not yet `synced` are pushed and **merged** with cloud data (union). Cloud data is never overwritten or deleted, ever, by this specific process.
- Ongoing edits: conflict resolution is **per-field**, not per-record. Compare `field_updated_at` per field; later timestamp wins per field independently. Two devices editing different fields on the same task = both changes kept, no data lost.
- Deletion is separate from field-edit conflict resolution — see "Task completion & deletion" above. A completion always wins over a pending edit; it's never merged.
- Timestamps for conflict resolution are **always server-assigned at write time** — never trust a client-submitted timestamp for this. This is a hard rule, not a preference; it's what stops a wrong device clock from corrupting merge outcomes.
- Logout: if unsynced changes OR pending deletions exist, warn before clearing localStorage. Options: sync-first-then-logout, or discard-and-logout. Never silently delete unsynced data. Never block logout indefinitely on a stuck sync — the warning dialog is the only gate.

**`ui-ux-pro-max`**
- This is a design-intelligence *skill* for AI coding assistants (style/color/typography recommendations), not an npm package or component library. Do not `npm install` it, do not `import` from it. It informs how you write Tailwind components by hand; it is never a runtime dependency.

## Where Logic Lives

- `src/lib/ai-extraction.ts` — the multi-provider extraction wrapper: tries Gemini, checks proactive rate-limit state via `src/lib/rate-limit.ts`, falls back to Groq, normalizes both providers' responses to a common shape, returns the "unavailable" state if both fail. Replaces the old single-provider `src/lib/gemini.ts`.
- `src/lib/providers/gemini.ts` — Gemini-specific SDK config, prompt, and response adapter.
- `src/lib/providers/groq.ts` — Groq-specific SDK config (`openai/gpt-oss-120b`), prompt, and response adapter.
- `src/lib/rate-limit.ts` — reads/writes proactive per-provider request counters in Upstash Redis; must fail open on any Redis error (see rule above).
- `src/lib/date-parser.ts` — wraps `chrono-node`; takes a task's `raw_segment` and the browser's local `Date`, returns a UTC ISO `due_date` or `null`.
- `src/lib/urgency.ts` — the single deterministic due_date → urgency_column function; used at task creation AND on every TaskBoard render. Never duplicate this logic elsewhere.
- `src/lib/sync.ts` — all sync/merge/conflict-resolution logic, including deletion reconciliation on pull (removes local tasks that are `synced: true` but missing from cloud)
- `src/lib/supabase.ts` — Supabase client
- `src/components/TaskBoard.tsx` — the 4-column render (calls lib/urgency.ts per unpinned task on every render), the long-press/right-click handler (fires column highlight + "..." icon + green checkmark simultaneously), highlight-then-tap column move logic, the pending-deletion undo buffer, and the pin indicator on locked tasks
- `src/components/EditMenu.tsx` — the "..." edit menu (title/category free text, due_date via date picker with explicit clear action); writes go through the same field-level update path TaskBoard already uses for moves, so `field_updated_at` handling is shared, not duplicated
- `src/components/InputEngine.tsx` — SpeechRecognition + fallback state machine
- `src/app/actions/` — Server Actions (only place AI provider calls with secrets are allowed to run)

## Security Non-Negotiables

- Both Gemini and Groq API keys never touch the client. All AI provider calls run server-side via Server Actions.
- Supabase RLS: every row read/write is scoped to `user_id = auth.uid()`. No exceptions.
- `.env` vars: only `NEXT_PUBLIC_`-prefixed values are client-exposed. Everything else stays server-only, including both AI provider keys and Upstash Redis credentials.

## Flagged — Ambiguous, Not Yet Decided (confirm before implementing)

- **Gemini's current free-tier RPM/RPD/TPM figures are not verified in this document.** The proactive rate-limit thresholds in `src/lib/rate-limit.ts` must be set from Google AI Studio's currently published limits at implementation time, not from an assumed or historical number — confirm before writing the actual threshold constants.
