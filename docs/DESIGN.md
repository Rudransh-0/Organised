# Design System: Organised (AI-Powered To-Do List)
*A fluid, human-centered semantic design system engineered with Apple-tier craft, minimalist calm, and zero-latency responsiveness.*

---

## 1. Visual Theme & Atmosphere

Organised is built as a serene, tactile sanctuary from cognitive overwhelm. Traditional to-do apps provoke anxiety with rigid folder hierarchies, mandatory form pickers, and cluttered metadata dials. In contrast, Organised adopts **Apple's core design philosophy — an interface that stops feeling like a computer and starts feeling like an extension of the user's mind.**

- **Atmosphere:** An airy, sunlit architect's drafting table. High contrast, warm tactile paper surfaces, whisper-quiet borders, and frosted translucent glass layers.
- **Density: 4 / 10 ("Daily App Balanced" with "Gallery Airy" breathing room)**  
  Generous internal padding (`2rem` / `32px` on desktop containers) ensures thoughts never feel crowded. Elements maintain clear spatial separation without feeling sparse.
- **Variance: 6 / 10 ("Offset Asymmetric Structure")**  
  An asymmetric rhythm cleanly separates the fluid Brain-Dump Input Canvas from the structured 4-column Urgency Board below.
- **Motion: Apple Fluid Dynamics (Critically Damped Springs & Instant Tactility)**  
  Motion behaves like physical matter: things respond instantly on `pointerdown`, move continuously, possess weight, and can be interrupted mid-flight without lag.

---

## 2. Color Palette & Material Architecture

The color system avoids the generic "AI neon purple / dark-mode cyber glow" cliché. It couples warm architectural neutrals with Apple-style translucent materials and a single grounding accent.

### A. Surfaces & Translucent Materials
Apple's materiality uses layered glass with high-frequency background blurs:
- **Canvas Mist (`#FBFBFA`)** — Primary ambient page background. A warm off-white that reduces eye fatigue compared to harsh sterile whites.
- **Paper Surface (`#FFFFFF`)** — Solid card containers, modal dialogs, and elevated surfaces.
- **Frosted Glass (`rgba(255, 255, 255, 0.78)`)** — Used for the sticky header and floating Brain-Dump Input bar. Paired with `backdrop-filter: blur(20px) saturate(180%)` and an interior highlight border.
- **Whisper Border (`rgba(0, 0, 0, 0.06)`)** — 1px ultra-crisp hairline border. In high-density screens, accompanied by a top 0.5px white specular rim (`rgba(255, 255, 255, 0.8)`).
- **Ambient Occlusion Shadow (`0 1px 2px rgba(0,0,0,0.03), 0 8px 24px rgba(0,0,0,0.04)`)** — Soft, multi-stop diffused shadow that anchors elements without looking muddy.

### B. Typography Colors
- **Charcoal Ink (`#16171A`)** — Primary typography and structural headers (Zinc-950 depth). *Pure black (`#000000`) is strictly banned.*
- **Muted Slate (`#64748B`)** — Secondary text, column counts, timestamps, and placeholder copy.
- **Subtle Tertiary (`#94A3B8`)** — Keyboard hints, inactive icons, and auxiliary metadata.

### C. System Accent (Strictly 1 Primary Accent)
- **Terracotta Ember (`#C25936`)** — Single primary accent (Saturation: 57%). Inspired by Apple's grounding earthy watch-band tones. Used exclusively for primary interactive focal points: the "Organize" action, active microphone recording states, input focus rings, and pinned card indicators.

### D. Calibrated Semantic Category Tokens (Desaturated Organic Accents)
Categories generated dynamically by the AI are mapped to subtle 3px left-edge indicator bars or 8px circular pips on cards — never loud card background fills:
- **Deep Focus & Work:** *Slate Indigo* (`#475569`)
- **Personal & Living:** *Forest Celadon* (`#2E6F54`)
- **Urgent & Vital:** *Warm Brick* (`#A8422B`)
- **Errands & Shopping:** *Raw Ochre* (`#8C6D3B`)
- **Health & Wellness:** *Dusty Sage* (`#5A786B`)

---

## 3. Typography Architecture (Optical Hierarchy)

Typography avoids generic system fonts while adhering to Apple's optical sizing, tight tracking, and relaxed leading principles.

- **Display / Headlines:** `Cabinet Grotesk` (Fallback: `Outfit`, `system-ui`)  
  Track-tight (`letter-spacing: -0.035em`), confident, warm grotesque letterforms. Visual authority is communicated through weight and contrast, not bloated font sizes.
- **Body & Prompts:** `Satoshi` (Fallback: `sans-serif`)  
  Human-centered leading (`line-height: 1.6`), max line-length of `65ch`. Flawless legibility at standard `1rem` (16px) body scale.
- **Monospace & Metadata:** `JetBrains Mono` (Fallback: `ui-monospace`)  
  Tabular numerals for all high-density numbers: column task counters (`[03]`), deterministic due dates (`Tomorrow, 18:00`), pin indicators, and keyboard shortcuts.
- **Banned:** `Inter` is banned for creative surfaces. Generic serif fonts (`Times New Roman`, `Georgia`, `Garamond`) are strictly banned.

---

## 4. Component Stylings & Interaction Craft

### A. The Brain-Dump Input Canvas
- **Visual Structure:** Floating translucent island (`rgba(255, 255, 255, 0.85)` + `backdrop-blur-xl`) with rounded corners (`1.5rem` / `24px`) and a 1px hairline border.
- **Textarea:** Seamless, borderless auto-expanding area. Placeholder in `Muted Slate`: *"Speak or type whatever is on your mind... laundry tonight, email Sarah by Friday, pay electric bill"*.
- **Microphone Interaction:** 
  - Resting state: `48px` circular tactile button with soft border.
  - Active Recording: An acoustic breathing glow using `Terracotta Ember` at 20% opacity with a smooth spring expansion (`scale(1.05)`).
- **"Organize" Button:** Solid `Terracotta Ember` (`#C25936`), crisp white text, tactile `-1px` depression and `scale(0.97)` on `pointerdown`.
- **Instant Fallback States:** Gentle, non-blocking inline warning if voice recognition is unsupported or permissions are denied.

### B. Dynamic Urgency Board (4 Fixed Columns)
Columns: **Urgent**, **Upcoming**, **Backlog**, and **Undefined**.
- **Column Headers:** Monospace uppercase labels (e.g., `URGENT · 03`) with a muted counter badge in `JetBrains Mono`.
- **Column Droppable State (Highlight-then-Tap):** When a user long-presses (mobile) or right-clicks (desktop) a card, all four columns illuminate with a subtle dashed border (`#C25936` at 15% opacity) and smooth background tint, signaling they are active one-tap move targets.

### C. Task Cards
- **Geometry:** Rounded corners (`1.25rem` / `20px`), pure `Paper Surface` fill, 1px `Whisper Border`.
- **Resting Depth:** `0 1px 3px rgba(0,0,0,0.02), 0 6px 16px rgba(0,0,0,0.03)`.
- **Active / Pressed State:** Responds instantly on `pointerdown` with `transform: scale(0.98)` via spring physics.
- **Pinned Indicator:** When manually moved, an elegant `14px` geometric pin icon appears in `Terracotta Ember` beside the date, indicating auto-recomputation is locked.
- **Contextual Actions (Fired Simultaneously on Long-Press / Right-Click):**
  - **Quick Complete Checkmark:** Circular emerald ring (`#2E6F54`) for instant one-tap completion.
  - **Edit Menu ("..."):** Opens `EditMenu.tsx` to adjust title, category, or date (with an explicit *"Clear date"* button).

### D. Edit Menu (`EditMenu.tsx`)
- **Desktop:** Centered floating modal with backdrop blur.
- **Mobile:** An authentic **Apple-style Bottom Sheet** (via Vaul) with a tactile drag handle, velocity-projected dismissal, and momentum springs.

### E. System Feedback & Alerts
- **Thinking / Processing Loader:** Segmented undulating wave shimmer matching input canvas geometry. Circular spinning wheels are banned.
- **High-Traffic Graceful Fallback:** Calm, reassuring banner: *"We're experiencing heavy traffic right now — please wait a moment and try again."* The user's typed or transcribed text is completely preserved.
- **Undo Toast (Sonner Dynamic Capsule):** Low-profile pill floating at bottom center (`backdrop-blur-xl bg-zinc-900/90 text-white`): *"Task completed · [Undo]"* with an active 5–10 second recovery window and swipe-to-dismiss.

---

## 5. Mobile-Native Touch Ergonomics (< 768px)

- **Single-Column Mobile Collapse:** Multi-column layout cleanly collapses into a single active view with a smooth horizontal pill switcher (`Urgent`, `Upcoming`, `Backlog`, `Undefined`).
- **Thumb Zone Safety:** Brain-dump input remains sticky and thumb-accessible.
- **Touch Target Standard:** All interactive elements maintain a strict minimum `48px x 48px` tap target.
- **Zero Tap Delay:** Eliminate 300ms tap delay; trigger active states on `pointerdown`.
- **Disable Sticky Touch Hover:** All hover states wrapped in `@media (hover: hover) { ... }` so tapped buttons never get stuck in hover state on mobile screens.
- **Viewport Stability:** Section wrapper strictly uses `min-h-[100dvh]` to eliminate iOS Safari address-bar layout jumping. *`h-screen` is banned.*

---

## 6. Motion Philosophy & Spring Physics

Apple's motion foundation: **behavior over animation.** Springs are inherently interruptible, velocity-aware, and natural.

### A. Spring Parameter Defaults
Using Apple's two primary parameters (Damping Ratio & Response):

| Interaction Type | Damping Ratio | Response / Duration | Feel & Rationale |
| :--- | :---: | :---: | :--- |
| **Tactile Press (Buttons & Cards)** | `1.0` (Critically Damped) | `0.20s` | Instant `scale(0.97)` on `pointerdown`, zero bounce, instantaneous feedback. |
| **Column Move / Re-layout** | `1.0` (Critically Damped) | `0.35s` | Smooth physical glide into new column without oscillating overshoot. |
| **Bottom Sheet / Drawer** | `0.85` | `0.35s` | Natural momentum settle with velocity handoff from the user's finger. |
| **Card Mount (Waterfall)** | `1.0` | `0.30s` | Staggered cascade (`40ms` interval) as AI parsed tasks populate the board. |
| **Card Completion Dismissal** | `1.0` | `0.25s` | Quick compression (`scale(0.94)`), opacity fade, and smooth vertical collapse. |

### B. Core Motion Rules
1. **Interruptibility Above All:** Never lock out touch or keyboard input during a transition. A user must be able to tap or reverse mid-animation.
2. **Animate from Current Values:** Always animate from the live presentation transform, never snapping to target before moving.
3. **Hardware Acceleration Only:** Strictly animate `transform` and `opacity`. Never animate `top`, `left`, `width`, or `height`.

---

## 7. Anti-Patterns (Strictly Banned)

1. **No Emojis:** Never use emojis in UI buttons, column headers, or status tags. Use clean geometric SVG icons only.
2. **No Generic System Fonts:** `Inter`, `Times New Roman`, `Georgia`, and standard Arial/Segoe fallbacks are banned.
3. **No Pure Black (`#000000`):** Use deep `Charcoal Ink` (`#16171A`).
4. **No AI Neon / Cyber Glows:** No purple button glows, no saturated neon outlines, no glowing gradient borders.
5. **No Drag-and-Drop Complexity:** Moving tasks is strictly **highlight-then-tap**, not freeform 2D drag-and-drop. Avoid complex gesture conflicts.
6. **No Centered Marketing Heros:** The input area is a functional workstation, not a landing page. No "Scroll to explore" text or bouncing chevrons.
7. **No AI Copywriting Clichés:** Ban "Unleash", "Seamless AI magic", "Elevate your productivity". Speak with humble clarity.
8. **No Silent Quality Degradation:** Never fabricate lower-quality non-AI tasks on rate limit. Display an honest, calm retry prompt.
