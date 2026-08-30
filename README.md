# Organised — AI-Powered To-Do List

A lightweight web app where you speak or type a messy, stream-of-consciousness brain-dump, and AI automatically parses it into a structured, organized to-do list — no clicking "add," no manually setting dates, no folders to pick.

Built for people who feel overwhelmed by rigid task managers and just need to get things out of their head quickly, before they forget.

## Status: Pre-development

This repo currently holds the finished product spec and system architecture — implementation hasn't started yet. The plan is to build in public from here, spec-first, so the reasoning behind each feature is documented before any code is written.

- 📄 [Product Requirements Doc](./docs/PRD.md) — what we're building, why, and the exact user journey
- 🏗️ [Architecture](./docs/ARCHITECTURE.md) — technical design and system structure
- 🧩 [Architecture Essentials](./docs/ARCHITECTURE_ESSENTIALS.md) — condensed technical reference

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Backend/Auth:** Supabase (Free Tier)
- **AI Extraction:** Google Gemini (primary), Groq `gpt-oss-120b` (fallback)
- **Deployment:** Vercel

## Key Design Decisions

- **Zero infrastructure cost** — strictly free-tier services across the stack.
- **AI never invents due dates.** Task titles and categories come from the AI; due dates are resolved separately by deterministic, local date-parsing code against the user's own device clock — no timezone data ever sent to the AI.
- **No silent quality degradation.** If both AI providers are unavailable, the app tells the user to wait and retry rather than falling back to a worse, non-AI result.
- **Works instantly, no account required.** Local-first storage via `localStorage`; cloud sync is optional and added later.

## Next Steps

Implementation starting with Feature 1 (Brain-Dump Input) and Feature 2 (AI Extraction Engine).# Organised