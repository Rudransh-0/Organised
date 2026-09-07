# Architecture Overview

This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure

This repository follows a standard Next.js App Router convention, flattened for a serverless deployment model. UI components are hand-built with Tailwind CSS, using the `ui-ux-pro-max` skill (nextlevelbuilder/ui-ux-pro-max-skill) as a development-time design reference — not a runtime dependency — for style, color, typography, and UX-pattern decisions.

```
[Project Root]/
├── src/
│   ├── app/                # Next.js App Router (Frontend & Backend Routes)
│   │   ├── api/            # Route handlers (OAuth callbacks)
│   │   ├── actions/        # Server Actions (AI extraction chain, DB mutations)
│   │   ├── layout.tsx      # Global layout & providers
│   │   └── page.tsx        # Main application view (Input & Task Board)
│   ├── components/         # UI Components
│   │   ├── ui/             # Hand-built UI components, styled per the ui-ux-pro-max design reference
│   │   ├── TaskBoard.tsx   # Static 4-column layout; calls lib/urgency.ts on every render for unpinned tasks; owns the long-press/right-click handler (column highlight + "..." icon + green checkmark, fired simultaneously), highlight-then-tap column move logic, the pending-deletion undo buffer, and the pin indicator on locked tasks
│   │   ├── EditMenu.tsx    # "..." edit menu: title/category free text, due_date via date picker with explicit clear action; writes go through the same field-level update path as column moves
│   │   └── InputEngine.tsx # SpeechRecognition and text fallback wrapper
│   ├── lib/                # Shared utilities and configurations
│   │   ├── supabase.ts     # Supabase client instantiation
│   │   ├── ai-extraction.ts # Multi-provider wrapper: tries Gemini, checks rate-limit.ts, falls back to Groq, normalizes both providers' output, returns "unavailable" if both fail. Neither provider assigns due_date or urgency_column.
│   │   ├── providers/
│   │   │   ├── gemini.ts   # Gemini SDK config, prompt, response adapter (primary provider)
│   │   │   └── groq.ts     # Groq SDK config (openai/gpt-oss-120b), prompt, response adapter (fallback provider)
│   │   ├── rate-limit.ts   # Proactive per-provider request counters via Upstash Redis. Must fail open on any Redis error — quota assumed available, real call attempted, reactive 429 handling is the backstop.
│   │   ├── date-parser.ts  # Wraps chrono-node. Takes a task's raw_segment + the browser's local Date, returns a UTC ISO due_date or null. Runs client-side only — never sent to a Server Action.
│   │   ├── urgency.ts      # Pure function: due_date + viewer's local date → urgency_column. Single source of truth, used at task creation and on every TaskBoard render
│   │   └── sync.ts         # Local to Cloud sync, deletion reconciliation, and optimistic UI resolution logic
│   └── types/              # TypeScript definitions (Models, API responses)
├── public/                 # Static assets (icons, manifest)
├── .env.local              # Environment variables (Supabase, Gemini, Groq, Upstash Redis)
├── next.config.mjs         # Next.js configuration
├── tailwind.config.ts      # Tailwind utility configuration
├── package.json            # Dependencies and scripts
├── README.md               # Project overview
└── ARCHITECTURE.md         # This document
```

---

## 2. High-Level System Diagram

The system relies on a thick client for local-first interactions and serverless functions for secure AI execution and database syncing. Post-authentication data mutations utilize an Optimistic UI pattern: updates are written immediately to local state before syncing to the cloud in the background, reverting on failure.

```
[Client Browser (Speech/Text Input)]
|
+--> (Optimistic Write) --> [localStorage (UI State)]
|
+--> (Background Sync) ---> [Next.js Server Actions] <--> [Supabase Auth / PostgreSQL (Cloud State)]
|
+--> (AI Parsing) --------> [Next.js Server Actions] --> [Gemini API] --(on failure/near-limit)--> [Groq API]
|                                     |
|                                     +--> [Upstash Redis] (proactive rate-limit counters; fails open on error)
|
+--> (Date Resolution, local only) --> [chrono-node in-browser] (no server round-trip; uses device's own local Date)
```

---

## 3. Core Components

### 3.1. Frontend App

**Name:** Organised Web Application

**Description:** A local-first Next.js React application for text input and storage; voice input is not local, as it depends on the browser vendor's remote speech-to-text service via the SpeechRecognition API and requires network connectivity. Captures stream-of-consciousness input via `SpeechRecognition` or text, with the text path always available as a fallback. UI updates instantly via Optimistic UI patterns. Components are hand-built with Tailwind CSS; styling and design decisions (color palette, typography, layout patterns) follow the `ui-ux-pro-max` skill's recommendations. Tasks are strictly routed into four static columns: `'Urgent'`, `'Upcoming'`, `'Backlog'`, and `'Undefined'`. Unlike category or title, `urgency_column` is not AI-assigned — it is computed deterministically on the client from `due_date` and the viewer's current local date, using a shared pure function (see 3.2.1 and the threshold rule below), and recomputed on every render so a task's column keeps advancing automatically as its due date approaches or passes.

A long-press (mobile) or right-click (desktop) on any card fires three UI elements simultaneously, all from the same gesture: the four urgency columns highlight as tappable move-targets; a small "..." icon appears on the card, opening an edit menu; and a small green checkmark icon appears on the card for direct one-tap "Mark Complete" (see the Task Completion & Deletion rules below). This replaces an earlier single-popup design. Moving a task is highlight-then-tap, not drag-and-drop: tapping a highlighted column moves the card there and sets `urgency_pinned`, permanently exempting that task from auto-recompute — the stored `urgency_column` becomes authoritative from then on (see `urgency_column` / `urgency_pinned` in section 4.3). A pinned task displays a small pin indicator on its card at all times, distinguishing it visually from tasks still auto-tracking their due date.

The "..." icon opens `EditMenu.tsx`, letting the user change `title` (free text), `category` (free text, matching category's existing free-form nature), and `due_date` (via a date picker only — never free text, so no unparseable value can ever be submitted; an explicit "Clear date" action sets `due_date` back to `null`). Editing does not itself set `urgency_pinned` — only a manual column move does. Editing an unpinned task's `due_date` can therefore visibly change its urgency column the instant the edit is saved, since column placement always recomputes live from the current `due_date` regardless of how that value was set (AI extraction at creation, or manual edit later). Every edited field writes a fresh server-assigned timestamp into its `field_updated_at` entry — no new conflict-resolution logic is required; this reuses the same per-field last-write-wins mechanism already defined for AI-generated fields (3.2.2).

Because column recompute runs client-side against the viewer's local date, it relies on that device's own local clock — same mechanism `chrono-node` uses at creation time (3.2.1), though the two are separate calls with nothing shared or cached between them. A task rendered on two devices in different timezones must still land in the same column, since bucketing is by calendar day in local time. Categories generated by AI are visually mapped to color accents on cards, defined by a dynamic bottom legend.

**Urgency Threshold Rule (fixed, do not deviate without updating this doc):**
- `Urgent` — `due_date` falls on today, tomorrow, or the day after tomorrow (viewer's local calendar day).
- `Upcoming` — `due_date` is more than 2 days out.
- `Backlog` — `due_date` is in the past (yesterday or earlier). No completion check needed here — completed tasks are deleted (see below), so any task that still exists is inherently incomplete.
- `Undefined` — `due_date` is `null`.

**Task Completion & Deletion Rule (applies to both anonymous and authenticated users):**
- Tapping the green checkmark icon (shown on long-press/right-click, alongside the "..." edit icon and column highlights — see above) removes the task from the visible board and from the primary `localStorage` task list **immediately** — this happens the same way regardless of login state.
- The task is not gone yet: it's held in an in-memory-only "pending deletion" buffer for 5–10 seconds, during which a toast/snackbar shows an "Undo" action.
  - **Undo tapped:** the task is restored to the board and `localStorage` exactly as it was. Nothing was ever sent to Supabase, so there is nothing to reconcile.
  - **Window expires without undo:** the task is now permanently gone locally. For authenticated users only, a background `DELETE` request is fired to Supabase for that row (retried on reconnect like any other background sync request if offline). Anonymous users have no cloud leg, so nothing further happens.
- The pending-deletion buffer does not survive a page reload — if the user reloads mid-window, the undo opportunity is lost and the task stays deleted. This is an accepted V1 limitation, not a bug worth solving now.
- **Delete-vs-edit conflict:** if another device has an unsynced edit to a task that gets completed elsewhere, the deletion always wins once that device syncs — the unsynced edit is silently discarded. Completing a task is treated as a final, stronger signal than any pending field edit.
- **Cross-device propagation:** deletion is not realtime. A task deleted upstream disappears from another device the next time that device performs a full reconciliation pull — which now happens on login **and** on every subsequent app load while authenticated, not just the first-ever login. Mechanism: any local task flagged `synced: true` that is absent from a fresh cloud pull is inferred as deleted upstream and removed locally. A local task that has never been pushed (`synced` false/absent) is never removed this way, so new offline tasks can't be mistaken for deletions.
- **Logout interaction:** a task still sitting in the pending-deletion buffer (undo window not yet expired, cloud delete not yet fired) counts as an unsynced change for the purposes of the logout warning dialog (section 3.2.2).

**Task Editing Rule:**
- The "..." icon opens `EditMenu.tsx`, covering three fields: `title` (free text), `category` (free text — consistent with category's existing free-form, AI-generated nature; not a fixed dropdown), and `due_date` (date picker only).
- `due_date` editing never accepts free text. The date picker either returns a valid date or nothing; there is no code path where an unparseable value can be submitted. An explicit "Clear date" action sets `due_date` to `null`, which is functionally identical to the AI finding no date at creation — the task lands in `Undefined`.
- Editing any field does **not** set `urgency_pinned`. Only a manual column move (highlight-then-tap) does that. A user can edit `due_date` on an unpinned task repeatedly and it will keep auto-recomputing its column afterward, exactly as if the date had come from the AI originally.
- Every edit writes a fresh, server-assigned timestamp into that field's `field_updated_at` entry — the same mechanism already used for AI-generated field writes (section 3.2.2). No new sync or conflict-resolution logic is introduced by this feature; editing is just another timestamped write to a field the sync engine already tracks.

**Technologies:** Next.js (App Router), React, Tailwind CSS, browser-native `SpeechRecognition` API (client-side call to a browser vendor's remote transcription service; not on-device; unsupported in some browsers, notably Firefox) with mandatory text-input fallback for unsupported browsers, denied microphone permission, and failed/empty recognition results, `window.Notification` API (for native, open-tab browser alerts).

**InputEngine Failure Handling:** `InputEngine.tsx` must handle three distinct SpeechRecognition failure states independently: unsupported browser (feature-detect on mount), denied microphone permission (catch on `onerror` with `error: 'not-allowed'`), and failed/empty recognition (catch on `onerror` for other error codes, and handle `onresult` returning an empty transcript). All three states fall back to enabling the text input with a state-appropriate message; none of them should throw an unhandled exception to the console.

**Deployment:** Vercel

### 3.2. Backend Services

#### 3.2.1. AI Extraction Engine

**Name:** Next.js Server Actions (Multi-Provider AI Extraction Chain)

**Description:** Securely executes the task-extraction prompt against a two-provider fallback chain: **Google Gemini (primary)**, falling back to **Groq running `openai/gpt-oss-120b` (secondary)** only when Gemini is unavailable or near its rate limit. Both providers are called through the same `src/lib/ai-extraction.ts` wrapper and must return a normalized common shape — provider-specific quirks (extra prose, reasoning-block wrapping, differing JSON syntax) are stripped/parsed at each provider's adapter (`src/lib/providers/gemini.ts`, `src/lib/providers/groq.ts`) and never leak past the wrapper.

Each provider enforces a strict JSON schema, parsing the user's raw text into discrete tasks, each with a `title`, `category`, and `raw_segment` — the exact substring of the original input that provider attributed to that task. **Neither provider extracts, resolves, or is even prompted for a `due_date`.** That responsibility, along with `urgency_column` before it, has moved entirely out of the LLM's error surface: `due_date` is now resolved by deterministic client-side code (`src/lib/date-parser.ts`, wrapping `chrono-node`) run against each task's own `raw_segment`, and `urgency_column` remains the deterministic client-side function it already was (see 3.1's Urgency Threshold Rule and `src/lib/urgency.ts`). `Undefined` still falls out automatically whenever the resolved `due_date` is `null` — now via `chrono-node` finding no date phrase in the segment, rather than via an AI judgment call.

**Neither provider receives `client_timestamp` or `client_timezone` anymore.** Since date resolution no longer happens in the AI call, there is nothing for those fields to be used for server-side — they have been removed from the request payload entirely. Date resolution instead happens in the browser, against the browser's own local `Date` object, immediately after the AI response returns; see 4.3 and `src/lib/date-parser.ts`.

**Fallback and rate-limit handling:** Before calling Gemini, the wrapper checks a proactive per-provider request counter in Upstash Redis (`src/lib/rate-limit.ts`). If Gemini is at or near its published free-tier limit, the call is skipped in favor of Groq directly, avoiding a wasted request/latency cycle. If Gemini is attempted and fails outright (429, 5xx, timeout, or a response that fails schema validation after adapter parsing), Groq is tried as the reactive fallback regardless of what the proactive counter indicated. The same proactive-check-then-reactive-fallback pattern applies to Groq before the chain is considered exhausted. **Rate-limit tracking must fail open:** if Upstash Redis is unreachable or errors for any reason, quota is assumed available and the real provider call proceeds as normal — a genuine 429 from the provider is still caught reactively as the backstop. Redis availability must never itself be a cause of task-creation failure, since its only role is optimization, not gating.

**If both Gemini and Groq are exhausted or fail:** the Server Action returns an explicit "unavailable" result. No AI-based or rule-based degraded extraction is attempted as a third tier — this was a deliberate product decision to prefer an honest "heavy traffic, try again" state over a silently lower-quality result. The client preserves the user's raw input unchanged for retry.

**Technologies:** Node.js, Google Gen AI SDK, Groq SDK, Upstash Redis (`@upstash/redis`), `chrono-node` (client-side only).

**Deployment:** Vercel (Serverless Functions) for the extraction chain and rate-limit checks; `chrono-node` ships as a client bundle dependency, not a server call.

#### 3.2.2. Authentication & Data Sync Service

**Name:** Supabase Client/Server Integration

**Description:** Handles Google OAuth and Email/Password flows.

* **Initial Login Conflict Resolution:** On first authentication, local tasks not yet marked `synced` are pushed to Supabase as new rows and merged (union, not overwrite) with any existing cloud tasks for that user. The merged set is pulled back and written to localStorage, and all local tasks are flagged `synced` to prevent duplicate pushes on repeat logins from the same device. Cloud data is never deleted or overwritten by this process.

* **Post-Sync Edit Conflict Resolution:** Conflict resolution is per-field, not per-record, and applies only to edits on tasks that still exist on both sides — deletion is a separate mechanism (see Task Completion & Deletion Rule, section 3.1) that always overrides a pending edit rather than merging with one. Each mutable field (`title`, `category`, `urgency_column`, `due_date`) carries its own last-modified timestamp in `field_updated_at`. When syncing an edited task, incoming and existing values are compared field-by-field; if both sides changed different fields, both changes are merged into the result. If both sides changed the same field, the value with the later timestamp wins. All timestamps used for comparison are assigned server-side at write time (via the Server Action / Supabase insert), never taken from client-submitted values, to prevent conflict outcomes from being altered by an incorrect or manipulated client clock.

* **Post-Auth Data Flow:** Follows an Optimistic UI model. Client mutations update `localStorage` and React state immediately, followed by a background server action to mutate Supabase. If the Supabase mutation fails, the client state is rolled back.

* **Logout Behavior:** On logout initiation, the client checks whether any tasks have unsynced changes (i.e. a `field_updated_at` timestamp newer than the last confirmed server write for that field) **or** are still sitting in the pending-deletion buffer (Mark Complete undo window not yet expired). If neither, logout proceeds immediately: `localStorage` is cleared client-side (a privacy measure for shared/public devices, not a sync operation) and the app reverts to the anonymous, local-only state. If either exists, logout is deferred pending user confirmation via a warning dialog with two options: "Sync First" triggers an immediate foreground sync attempt (including firing any pending deletes early); on success, logout proceeds and `localStorage` is cleared; on failure, the dialog surfaces the error, logout is cancelled, and the user remains authenticated with unsynced data intact locally. "Continue Anyway" proceeds directly to logout and clears `localStorage`, explicitly discarding the unsynced changes at the user's request. This makes data loss an explicit user decision, not a default system behavior.

**Technologies:** Supabase Auth, PostgreSQL.

**Deployment:** Supabase Managed Cloud

---

## 4. Data Stores & Schemas

### 4.1. Local Storage (Primary V1 Store & Optimistic State)

**Name:** Browser `localStorage`
**Type:** Key-Value Store
**Purpose:** Delivers instant, account-less functionality. Acts as the primary source of truth for anonymous users and as the immediate optimistic state cache for authenticated users.
**Key Schemas:** JSON array of `Task` objects.

### 4.2. Cloud Database

**Name:** Supabase PostgreSQL
**Type:** Relational Database
**Purpose:** Enables cross-device sync for authenticated users.
**Key Schemas:** `tasks` table.

### 4.3. Core API & Schema Contracts

To ensure synchronization between AI provider output (Gemini or Groq), the client-side date parser, Frontend State, and the Supabase Database, all tasks strictly adhere to the following interface. All persisted timestamp fields (`due_date`, `created_at`, and every entry in `field_updated_at`) must be strictly ISO 8601 UTC strings to prevent local timezone rendering bugs and to keep conflict-resolution comparisons unambiguous.

```typescript
interface Task {
  id: string; // UUID v4
  user_id?: string; // Nullable for anonymous users, populated by auth.uid()
  raw_input: string; // The original full stream-of-consciousness text
  raw_segment: string; // The exact substring of raw_input the AI provider (Gemini or Groq) attributed to THIS task. Used exclusively by client-side lib/date-parser.ts (chrono-node) to resolve this task's own due_date at creation, then dropped immediately after — not retained in localStorage, not displayed in the UI, not user-editable, never synced to Supabase (see note below the interface).
  title: string; // AI-generated concise task action (Gemini primary, Groq fallback)
  category: string; // AI-generated category, utilized solely for visual color tagging (Gemini primary, Groq fallback)
  urgency_column: 'Urgent' | 'Upcoming' | 'Backlog' | 'Undefined'; // Authoritative ONLY when urgency_pinned is true. Set once at creation via lib/urgency.ts; while unpinned, the frontend ignores this stored value on every render and recomputes it live from due_date + the viewer's local date instead — so this field can be stale in storage without being a bug.
  urgency_pinned: boolean; // false by default. Set to true the first time a user manually moves the card via tap-and-hold. Once true, permanently exempts this task from auto-recompute — the stored urgency_column above becomes authoritative and is never silently overwritten again. Always changes atomically with urgency_column, so it shares that field's entry in field_updated_at rather than getting its own key.
  due_date: string | null; // Strict ISO 8601 UTC string. Computed client-side by lib/date-parser.ts (chrono-node) from raw_segment — NOT extracted or resolved by any AI provider.
  created_at: string; // Strict ISO 8601 UTC string, server-assigned
  field_updated_at: {
    title: string;
    category: string;
    urgency_column: string; // Covers both urgency_column and urgency_pinned, since a manual move always writes both together.
    due_date: string;
  }; // Per-field ISO 8601 UTC timestamps, each server-assigned at write time. Used exclusively for per-field last-write-wins conflict resolution between devices. No entry for completion — completing a task deletes the row outright rather than setting a field (see 3.1's Task Completion & Deletion Rule).
  synced?: boolean; // Client-only flag, never persisted to Supabase. Marks whether this task has already been pushed to the cloud — also used to distinguish "not yet pushed" from "deleted upstream" during deletion reconciliation on pull.
}

```

`is_completed` was removed from this schema: since completed tasks are deleted rather than flagged, any row that still exists is inherently incomplete — a persisted `is_completed` field could never meaningfully hold `true`. If a future "archive instead of delete" feature is added, this field should be reintroduced then, not before.

`raw_segment` is never synced to the Supabase `tasks` table, and is not retained locally past creation either — it's a transient extraction artifact needed only once, at creation time, to compute `due_date` client-side. Nothing downstream ever reads it again (`urgency_column` recompute only ever consumes `due_date`), so it's dropped from the local `Task` object immediately after `due_date` is computed.

---

## 5. External Integrations / APIs

**Service Name 1:** Google Gemini API (Free Tier) — Primary AI Provider
**Purpose:** Natural language processing to segment unstructured input into discrete tasks and extract `title`, `category`, and `raw_segment` (the original substring) for each. Does **not** extract or resolve due dates — that responsibility moved to client-side `chrono-node`. Tried first on every extraction request, subject to a proactive rate-limit check (see Service Name 3).
**Integration Method:** Next.js Server Actions (REST/SDK), via `src/lib/providers/gemini.ts`.
**Note:** Confirm current published free-tier RPM/RPD/TPM limits from Google AI Studio before finalizing the proactive rate-limit thresholds — not independently verified as of this revision.

**Service Name 2:** Groq API, `openai/gpt-oss-120b` (Free Tier) — Fallback AI Provider
**Purpose:** Same extraction contract as Gemini (`title`, `category`, `raw_segment` per task), used only when Gemini is unavailable, erroring, or at/near its rate limit. Free-tier limits: 30 requests/min, 1,000 requests/day, 8K tokens/min, 200K tokens/day.
**Integration Method:** Next.js Server Actions (REST/SDK), via `src/lib/providers/groq.ts`. Response is normalized to the same shape Gemini returns before reaching the caller — reasoning-block or prose-wrapped output must be stripped at this layer.

**Service Name 3:** Upstash Redis (Free Tier, via Vercel Marketplace integration)
**Purpose:** Proactive per-provider request-rate tracking, so the extraction chain can skip a near-exhausted provider before attempting (and failing) a call to it. Purely an optimization layer, not a gate — see the fail-open rule in 3.2.1.
**Integration Method:** `@upstash/redis` client, via `src/lib/rate-limit.ts`, called from the same Server Action as the AI providers.

**Service Name 4:** Supabase (Auth & DB)
**Purpose:** Google OAuth, password recovery, and PostgreSQL cloud syncing.
**Integration Method:** Supabase JavaScript SDK.

---

## 6. Deployment & Infrastructure

**Cloud Provider:** Vercel, Supabase, Upstash (via Vercel Marketplace)
**Key Services Used:** Vercel Serverless Functions, Supabase Auth, Supabase Postgres, Upstash Redis (rate-limit counters, free tier).
**CI/CD Pipeline:** Vercel GitHub Integration (automated builds on `main` push).
**Monitoring & Logging:** Vercel Analytics, Supabase Dashboard Logs. **Flagged:** no monitoring currently specified for AI provider fallback frequency (i.e. how often Groq is actually being invoked as a fallback) — worth adding a lightweight log/metric here so provider-chain health is visible, not just inferred from user complaints.

---

## 7. Security Considerations

**Authentication:** Supabase Auth (OAuth2 & JWT).
**Authorization:** Supabase Row Level Security (RLS) ensuring users can only read/write tasks where `tasks.user_id = auth.uid()`.
**Data Encryption:** TLS in transit. Data at rest managed by Supabase.
**Key Security Tools/Practices:** Server-side execution for all Gemini and Groq API calls to prevent API key leakage. Upstash Redis credentials are also server-only — the client never talks to Redis directly. Environment variables strictly segregated between client (`NEXT_PUBLIC_`) and server.

---

## 8. Development & Testing Environment

**Local Setup Instructions:**

1. Clone repo and install dependencies (`npm i`).
2. (Optional, dev-time only) Install the `ui-ux-pro-max` skill in your AI coding assistant for design-system guidance while building components — this is not a project dependency and is not required to run the app.
3. Setup local `.env.local` with `GEMINI_API_KEY`, `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run `npm run dev`.

**Testing Frameworks:** Jest (Unit logic — including `lib/date-parser.ts` against the messy multi-task inputs used during provider evaluation, and `lib/urgency.ts` threshold edges), Playwright (E2E local-to-cloud sync flows, optimistic UI rollback validation, logout-with-unsynced-data warning dialog, "Sync First" success and failure paths, "Continue Anyway" data-clear verification, and the Gemini→Groq fallback path — including a forced-failure test that confirms the "heavy traffic" state renders correctly when both providers are unavailable).
**Code Quality Tools:** ESLint, Prettier, TypeScript strict mode.

---

## 9. Future Considerations / Roadmap

* **Conflict Resolution Evolution:** V1 uses per-field last-write-wins (section 3.2.2), which silently discards the losing edit whenever two devices change the same field. Move beyond this to a true CRDT (Conflict-free Replicated Data Type) or richer timestamp-based merge strategy — one that can preserve or surface both conflicting edits instead of discarding one — as the user base matures and simultaneous multi-device editing increases.
* **Deletion vs. Edit Conflict:** V1 always lets a completion/deletion silently win over any concurrent unsynced edit on another device (section 3.1). A future version could instead surface a conflict to the user ("this task was completed on another device — apply your edit anyway?") rather than discarding the edit outright.
* **Service Worker Expansion:** Upgrade `window.Notification` to true Service Worker Push Notifications for background alerts when the application tab is closed.
* **Third AI fallback tier:** V1 deliberately stops at two providers (Gemini → Groq) and shows a "heavy traffic" message rather than degrading further. If real usage shows the two-provider chain being exhausted often enough to matter, revisit — options include a third free-tier provider or, as a last resort, a local rule-based extraction, accepting the quality trade-off explicitly rejected for V1.
* **Segmentation quality parity across providers:** Gemini and Groq were spot-checked against a small hand-written set of test inputs before this revision, not formally benchmarked. Worth building a small regression suite that runs both providers against a larger, messier input set periodically, since provider-side model updates could silently change segmentation behavior on either side of the chain.

---

## 10. Project Identification

**Project Name:** Organised
**Repository URL:** [Insert Repository URL]
**Primary Contact/Team:** Engineering
**Date of Last Update:** 2026-08-29

---

## 11. Glossary / Acronyms

**PRD:** Product Requirements Document
**RLS:** Row Level Security (PostgreSQL concept applied in Supabase to restrict data access).
**Server Actions:** Next.js feature allowing asynchronous functions to run securely on the server, called directly from client components.
**Optimistic UI:** A front-end pattern that simulates the results of a database mutation instantly, updating the UI before receiving a successful response from the server.
