Product Plan: Organised (AI-Powered To-Do List)

    📋 The Big Picture
        What are we building? A lightweight web application where users can speak or type a messy stream-of-consciousness and an AI automatically parses, categorizes, and organizes it into a structured to-do list.

        Who is this for? People who feel overwhelmed by traditional, rigid task managers and just need to "get things out of their head" quickly before they forget.

        Why are we building it? Standard to-do apps require too much friction (clicking "add," setting dates, picking folders). This solves the problem by letting the user simply talk or type naturally, offloading the organization work to AI.

    🎯 What Success Looks Like
        Our Main Goal: Build a fully functional V1 that successfully takes raw text/voice, extracts tasks via AI, and displays them correctly, spending exactly $0 on infrastructure.

    What this version WILL do:

        Work instantly without requiring an account. Text input and localStorage are fully on-device. Voice input uses the browser's native SpeechRecognition API, which sends audio to the browser vendor's speech-to-text service (e.g. Google's, in Chrome) — this requires an internet connection and is not on-device processing.
        Allow users to transcribe voice or type text.
        Use AI to segment the input into distinct tasks and assign a title and category to each. Due dates are extracted deterministically by local code, not by AI (see Feature 2).
        Automatically resolve relative due-date phrases ("tonight," "by Friday") against the user's own device clock, entirely on-device, with no setup required.
        Provide optional cloud sync across devices.
        Fall back gracefully to a secondary AI provider if the primary one is unavailable, and show a clear "high traffic" message in the rare case both are unavailable — never fabricate a lower-quality result silently.
        Let users manually edit any task's title, category, or due date after creation, and manually move a task between urgency columns — with a small pin indicator showing which tasks have been manually moved and are no longer auto-updating.

    What this version WILL NOT do:

        We will not build native iOS/Android apps.
        We will not build recurring tasks or complex project hierarchies.
        We will not use paid AI models (strictly free tier, on every provider in the AI fallback chain).
        We will not degrade extraction quality as a fallback — if no AI provider is available, the app tells the user to wait and try again rather than producing a lower-quality result.

    🚶‍♂️ The User's Journey (The "Happy Path")
        This is the exact step-by-step experience we want the user to have:

        1. The user visits the website on their phone or laptop.

        2. They instantly see a large text area and a microphone button (no login wall).

        3. They click the microphone and say: "I need to do laundry tonight, finish the math homework by Friday, and buy milk."

        4. They click "Organize." A brief loading state appears.

        5. The screen populates with three distinct tasks sorted into fixed structural columns based on Urgency: Urgent, Upcoming, Backlog, and Undefined (used when no due date could be extracted from the input). Categories will be dynamically assigned by the AI but represented visually via color-coded accents on the task cards, not by separate columns. A dynamic legend below the board will explain the active color mappings. A long-press (mobile) or right-click (desktop) on any card highlights the four columns as tappable move-targets and reveals two small icons on the card: a "..." to edit its title, category, or due date, and a green checkmark to mark it complete. Tapping a highlighted column moves the task there and locks it permanently in place — it stops auto-updating and shows a small pin indicator from then on. Tapping the green checkmark removes the task from the board.

        6. Later, they click "Login" and use their Google account to save this data to the cloud so they can see it on another device.

    ✨ Features We Need (What to Build)
        🔴 Must-Have Features (Can't launch without these)

            Feature 1: The Brain-Dump Input

            What it does: A prominent text input box and a microphone button leveraging the browser's native SpeechRecognition API.

            How it should behave: Voice input support varies significantly by browser (reliable in Chrome-based browsers; unsupported or inconsistent in Firefox and some mobile browsers). The app must detect and handle three distinct failure states, each falling back to the text input: (1) the browser does not support the SpeechRecognition API at all, (2) the user denies microphone permission, and (3) recognition starts but fails or returns no result (e.g. silence, network error to the recognition service). Each state shows a friendly fallback message telling the user to type instead; the message may vary by state where useful (e.g. distinguishing "your browser doesn't support voice input" from "we couldn't hear anything, try again or type").

            Feature 2: AI Extraction Engine (multi-provider)

            What it does: Sends the user's messy text to Google Gemini (free tier), our primary AI provider, which converts it into structured data: a title, a category, and the exact original substring for each distinct task it identifies. If Gemini is unavailable — rate-limited or erroring — the same request is automatically retried against Groq (free tier, running the `gpt-oss-120b` model) as a fallback, transparently to the user. The AI does not extract or assign due dates at all; that's handled entirely by local, deterministic code (see below), not by either AI provider.

            Due dates are resolved by a local date-parsing library running against each task's own extracted substring, compared against the user's own device clock at the moment of creation — no timezone or timestamp data is sent to either AI provider for this purpose. This is what makes relative phrases like "tonight" or "by Friday" resolve to the correct calendar date for wherever the user actually is, with zero setup and zero server round-trip for the date itself.

            The AI does not decide which urgency column a task belongs in either — that's worked out automatically from the resolved due date (see Feature 3).

            How it should behave: The UI must show a clear loading indicator (like a spinning brain or thinking dots) while the extraction is happening. If both Gemini and Groq are unavailable (rate-limited or erroring) when the user submits, the app shows a clear "We're experiencing heavy traffic right now — please wait a moment and try again" message and leaves the user's typed or transcribed text exactly as they left it, so nothing is lost and they can simply retry. The app never silently falls back to a lower-quality, non-AI extraction as a substitute — a visible "try again" beats a quietly worse result.

            Feature 3: Dynamic Task Board

            What it does: Displays the parsed tasks across four fixed structural columns representing Urgency: Urgent, Upcoming, Backlog, and Undefined. A task's column is worked out automatically from its due date, not assigned by the AI: due today, tomorrow, or the day after is **Urgent**; anything further out is **Upcoming**; any task whose due date has already passed is **Backlog**; a task with no due date at all is **Undefined**. This isn't a one-time assignment — a task keeps moving between columns automatically as its due date gets closer or passes, right up until a user manually moves it. Categories are generated by the AI and represented visually via color-coded accents on the task cards. A dynamic legend below the board explains the active color mappings.

            A long-press (mobile) or right-click (desktop) on any card triggers three things simultaneously: the four urgency columns highlight as tappable move-targets, a small "..." icon appears on the card to open its edit menu, and a small green checkmark icon appears on the card for one-tap "Mark Complete." Tapping a highlighted column moves the card there and permanently locks it — it stops auto-updating and the user's choice always wins from that point on. A task that's been manually moved this way shows a small pin indicator on its card at all times afterward, so users can tell at a glance which tasks are locked in place versus still auto-tracking their due date.

            The "..." icon opens an edit menu where the user can change a task's title (free text), category (free text), or due date (a date picker, with an explicit "Clear date" action that sends the task back to the Undefined column — there's no way to enter an unparseable date, since the picker only allows valid dates or none at all). Editing an unpinned task's due date can visibly move it to a different urgency column the moment the edit is saved, since column placement is always recomputed live from the current due date.

            How it should behave: If a user is brand new, show a friendly "Empty State" with examples of what they can type or say (e.g., "Try saying: Remind me to call Mom tomorrow."). The long-press/right-click gesture has no visual affordance on its own, so the empty state or a first-use tooltip should briefly mention it (e.g., "Long-press or right-click any card to edit, move, or complete it").

            Feature 4: Completing & Deleting Tasks

            What it does: Marking a task complete removes it from the board and, eventually, from storage entirely — completed tasks are deleted, not archived or hidden.

            How it should behave: Tapping the green checkmark icon (shown on long-press/right-click, see Feature 3) removes the task from view immediately, on any device, whether logged in or not. For a few seconds afterward, a small "Task completed — Undo" prompt stays on screen; tapping it fully restores the task exactly as it was, with nothing lost. If the user doesn't undo in time, the task is gone for good: on a logged-in device, it's then deleted from the cloud in the background so the undo window never has to wait on the network. If a task is deleted on one device while another device still shows it, the second device will drop it the next time it syncs — this isn't instant across devices, consistent with how this app handles sync everywhere else. If a task was edited on another device but hasn't synced yet when it gets completed elsewhere, the completion wins and that unsynced edit is discarded — completing a task is treated as the final word on it.

            Feature 5: Local-First Storage

            What it does: Saves all tasks immediately to the browser's localStorage so the app feels instant and works immediately without signing up.

        🟡 Nice-to-Have Features (Can wait for later)

            Feature 6: Cloud Sync & Authentication (Supabase)

            What it does: An optional login that syncs local tasks to the cloud so they're available across devices.

            How it should behave: Users can log in via Google OAuth or standard Email/Password, with a password reset email available for the latter. Logging in for the first time merges local tasks with any existing cloud tasks — nothing is ever overwritten or deleted. After that, changes save instantly on-device and sync to the cloud in the background, so the app never feels like it's waiting on the network. If the same task is edited on two different devices, each device's edits are combined automatically: changes to different fields are both kept, and if both devices changed the same field, the more recent edit wins with no manual merge required. On logout, if any changes haven't finished syncing yet — including a task still sitting in its "Undo" window from Feature 4 — the user is warned and can choose to sync first or log out anyway and lose those unsynced changes — so data loss on logout is always an explicit choice, never a silent default.

            Feature 7: In-App Notifications

            What it does: Alerts the user when a task's due date is reached, assuming they have the app open in a browser tab. This will exclusively use the native window.Notification API, which strictly requires the web application tab to remain active and open.

        💻 How the Website Looks & Feels
            Works on Phones & Desktops: The website must automatically shrink and look good on a smartphone screen. The input bar should be easily tappable with a thumb.

            Tech Stack Rules: Next.js (App Router), Tailwind CSS, Supabase (Free Tier), Google Gemini API (Free Tier, primary AI provider), Groq API running `gpt-oss-120b` (Free Tier, fallback AI provider), deployed on Vercel.

            Design Vibe: Clean, minimalist, and uncluttered. High contrast for readability. Built with Tailwind CSS; component styling and design decisions (color palette, typography, layout patterns) are guided during development by the 'UI UX Pro Max' skill — a design-intelligence reference for AI coding assistants, not an importable component library. It ships nothing to the browser and adds no runtime dependency.
