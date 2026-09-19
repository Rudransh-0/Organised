# UI & UX Design Specification: Organised

This document defines the complete UI/UX design architecture, component specifications, and visual tokens for **Organised**, generated via the unified design stack (`ui-ux-pro-max`, `stitch-design-taste`, `minimalist-ui`, `emil-design-eng`, `mobile-native`, `apple-design`, and `ask-sonner`).

The authoritative single-source-of-truth design system manifest is located at [`docs/DESIGN.md`](file:///d:/Organised/docs/DESIGN.md).

---

## 1. Visual Theme & Atmosphere

Organised is engineered as a calm, tactile sanctuary from cognitive overwhelm. Standard to-do apps trigger friction and anxiety through rigid folder hierarchies, mandatory date pickers, and cluttered metadata interfaces. Organised delivers an open, breathing workspace inspired by a clean architect's drafting table, married to Apple's fluid design standards.

- **Density (4 / 10):** Generous internal padding (`2rem` / `32px` on desktop containers), wide margins, and uncluttered card layouts.
- **Variance (6 / 10):** Asymmetric layout pairing the expansive Brain-Dump Input Canvas with the structured 4-column Urgency Board.
- **Motion (Apple Fluid Dynamics):** Weighted spring physics (`damping: 1.0`, `response: 0.35s`), zero-latency `pointerdown` feedback, and fully interruptible transitions.

---

## 2. Color Palette & Material Roles

The color system avoids the generic "AI neon purple / dark-mode glow" aesthetic, opting for warm architectural neutrals, Apple-style translucent materials, and an earthy terracotta accent.

| Token Name | Value | Role |
| :--- | :--- | :--- |
| **Canvas Mist** | `#FBFBFA` | Primary ambient page background. Reduces eye fatigue. |
| **Paper Surface** | `#FFFFFF` | Card backgrounds, input canvas elevation, dialogs. |
| **Frosted Glass** | `rgba(255, 255, 255, 0.78)` | Sticky header & input canvas (`backdrop-blur-xl saturate(180%)`). |
| **Charcoal Ink** | `#16171A` | Primary typography and high-contrast labels. (No pure `#000000`). |
| **Muted Slate** | `#64748B` | Secondary descriptions, timestamps, helper copy. |
| **Whisper Border** | `rgba(0, 0, 0, 0.06)` | 1px hairline structural borders. |
| **Terracotta Ember** | `#C25936` | Primary system accent (CTAs, active mic pulse, pinned state). |

### Calibrated Category Tokens
AI-categorized tasks display a subtle 3px left-border accent or 8px indicator pip:
- **Work / Deep Focus:** Slate Indigo (`#475569`)
- **Personal / Home:** Forest Celadon (`#2E6F54`)
- **Urgent / Vital:** Warm Brick (`#A8422B`)
- **Errands / Shopping:** Raw Ochre (`#8C6D3B`)
- **Health / Wellness:** Dusty Sage (`#5A786B`)

---

## 3. Typography Architecture (Optical Sizing)

- **Headlines & Display:** `Cabinet Grotesk` (Fallback: `Outfit`, `system-ui`)  
  Track-tight (`-0.035em`), high-contrast, weight-driven hierarchy.
- **Body & Prompts:** `Satoshi` (Fallback: `sans-serif`)  
  Comfortable leading (`1.6`), max line-length of `65ch`.
- **Numbers & Metadata:** `JetBrains Mono` (Fallback: `ui-monospace`)  
  Monospace tabular numerals for column task counters (`[03]`), deterministic due dates (`Tomorrow 18:00`), and timestamps.
- **Banned:** `Inter` is banned for creative surfaces. Generic serif fonts (`Times New Roman`, `Georgia`) are banned.

---

## 4. Key User Interfaces & Component Behaviors

### 1. The Brain-Dump Input Canvas
- **Visual Structure:** A large, floating translucent island with a subtle 1px border and soft diffused shadow (`0 8px 30px rgba(0,0,0,0.04)`).
- **Audio Feedback:** A dedicated 48px circular microphone button. While recording, displays a gentle, desaturated breathing pulse in `Terracotta Ember` at 20% opacity with a smooth spring scale (`scale(1.05)`).
- **Input Area:** Seamless auto-growing textarea without harsh inner borders.
- **Instant Fallback States:** Clear, non-disruptive inline messages if voice recognition is unavailable or denied by the browser.

### 2. The 4-Column Urgency Board
Tasks are arranged dynamically across four columns based on calculated due dates:
1. **Urgent:** Due today, tomorrow, or the day after.
2. **Upcoming:** Due further out.
3. **Backlog:** Tasks whose due date has elapsed.
4. **Undefined:** Tasks with no extractable due date.

- **Manual Pinning (Highlight-then-Tap):** Long-pressing (mobile) or right-clicking (desktop) simultaneously highlights all four columns as drop targets, reveals a "..." edit icon, and a green checkmark icon. Tapping a column moves the task there, locks it permanently (displaying a geometric pin icon in `Terracotta Ember`), and halts auto-recalculation.
- **Fast Completion:** A one-tap checkmark removes the task immediately with a 5–10 second Sonner-style "Undo" toast bar floating at bottom center.

### 3. Task Edit Drawer / Modal (`EditMenu.tsx`)
- Desktop: Centered modal with backdrop blur.
- Mobile: Authentic Apple bottom sheet with drag handle, velocity-projected dismissal, and spring momentum.
- Includes an explicit **"Clear Date"** action that safely returns the task to the **Undefined** column.

---

## 5. Mobile-Native Touch Ergonomics (< 768px)

- **Single-Column Mobile Collapse:** Multi-column layout cleanly collapses into a single active view with a smooth horizontal tab selector for the 4 urgency columns (`Urgent`, `Upcoming`, `Backlog`, `Undefined`).
- **Thumb Zone Safety:** Sticky thumb-accessible Brain-Dump input bar.
- **Touch Target Standard:** All interactive elements strictly meet a minimum `48px` tap target.
- **Zero Tap Delay:** Trigger active states on `pointerdown` via `scale(0.97)`.
- **Viewport Safety:** Section wrapper uses `min-h-[100dvh]` to eliminate mobile browser viewport jumping.

---

## 6. Anti-Patterns & Slop Prevention

- **No Emojis:** Do not use emojis in UI controls, status badges, or headers. Use clean SVG geometry.
- **No Neon Glows:** No glowing purple borders, cyber gradients, or saturated cards.
- **No Freeform Drag-and-Drop:** Task movement is strictly highlight-then-tap to prevent gesture ambiguity.
- **No Pure Black:** `#000000` is forbidden; use `#16171A`.
- **No AI Marketing Clichés:** Eliminate filler copy ("Unleash your productivity", "Scroll to explore").
- **No Silent Degradation:** If both AI providers fail, show a calm, friendly retry message and preserve the user's typed input intact.
