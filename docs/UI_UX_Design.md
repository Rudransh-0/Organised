# UI & UX Design Specification: Organised

This document defines the complete UI/UX design architecture, component specifications, and visual tokens for **Organised**, generated via the `stitch-design-taste` design system standards.

The accompanying single-source-of-truth design system manifest is located at [`DESIGN.md`](file:///d:/Organised/DESIGN.md).

---

## 1. Visual Theme & Atmosphere

Organised is built to be a calm, tactile sanctuary from cognitive overwhelm. Standard to-do apps introduce friction and anxiety through rigid folder trees, mandatory date pickers, and cluttered metadata interfaces. Organised delivers an open, breathing workspace inspired by a clean architect's drafting table.

- **Density (4 / 10):** Generous internal padding (`2rem` / `32px` on desktop containers), wide margins, and uncluttered card layouts.
- **Variance (6 / 10):** Asymmetric layout pairing the expansive Brain-Dump Input Canvas with the structured 4-column Urgency Board.
- **Motion (6 / 10):** Weighted spring physics (`stiffness: 120, damping: 20`) with physical button feedback and smooth card transitions.

---

## 2. Color Palette & Roles

The color system avoids the generic "AI neon purple / dark-mode glow" aesthetic, opting for warm architectural neutrals and an earthy accent.

| Token Name | Value | Role |
| :--- | :--- | :--- |
| **Canvas Mist** | `#FBFBFA` | Primary ambient page background. Reduces eye fatigue. |
| **Paper Surface** | `#FFFFFF` | Card backgrounds, input canvas elevation, dialogs. |
| **Charcoal Ink** | `#16171A` | Primary typography and high-contrast labels. (No pure `#000000`). |
| **Muted Slate** | `#64748B` | Secondary descriptions, timestamps, helper copy. |
| **Whisper Border** | `rgba(228, 228, 231, 0.75)` | 1px tactile structural borders. |
| **Terracotta Ember** | `#C25936` | Primary system accent (CTAs, active mic pulse, pinned state). |

### Calibrated Category Tokens
AI-categorized tasks display a subtle 3px left-border accent or 8px indicator pip:
- **Work / Deep Focus:** Slate Indigo (`#475569`)
- **Personal / Home:** Forest Celadon (`#2E6F54`)
- **Urgent / Vital:** Warm Brick (`#A8422B`)
- **Errands / Shopping:** Raw Ochre (`#8C6D3B`)
- **Health / Wellness:** Dusty Sage (`#5A786B`)

---

## 3. Typography Architecture

- **Headlines & Display:** `Cabinet Grotesk` (Fallback: `Outfit`, `system-ui`)  
  Track-tight (`-0.03em`), high-contrast, weight-driven hierarchy.
- **Body & Prompts:** `Satoshi` (Fallback: `sans-serif`)  
  Comfortable leading (`1.6`), max line-length of `65ch`.
- **Numbers & Metadata:** `JetBrains Mono` (Fallback: `ui-monospace`)  
  Monospace for column task counters (`[03]`), deterministic due dates (`Tomorrow 18:00`), and timestamps.
- **Banned:** `Inter` is banned for creative surfaces. Generic serif fonts (`Times New Roman`, `Georgia`) are banned.

---

## 4. Key User Interfaces & Component Behaviors

### 1. The Brain-Dump Input Canvas
- **Visual Structure:** A large, elevated paper-white card with a subtle 1px border and soft diffused shadow (`0 8px 30px rgba(0,0,0,0.04)`).
- **Audio Feedback:** A dedicated 48px circular microphone button. While recording, displays a gentle, desaturated breathing pulse in `Terracotta Ember` at 20% opacity.
- **Input Area:** Seamless auto-growing textarea without harsh inner borders.
- **Instant Fallback States:** Clear, non-disruptive inline messages if voice recognition is unavailable or denied by the browser.

### 2. The 4-Column Urgency Board
Tasks are arranged dynamically across four columns based on calculated due dates:
1. **Urgent:** Due today, tomorrow, or the day after.
2. **Upcoming:** Due further out.
3. **Backlog:** Tasks whose due date has elapsed.
4. **Undefined:** Tasks with no extractable due date.

- **Manual Pinning:** Long-pressing (mobile) or right-clicking (desktop) highlights all four columns as drop targets. Manually moving a task pins it permanently (displaying a geometric pin icon in `Terracotta Ember`) and halts auto-recalculation.
- **Fast Completion:** A one-tap checkmark removes the task immediately with a 5-second "Undo" toast bar floating at the bottom center.

### 3. Task Edit Drawer / Modal
- Simple, focused overlay: edit title, adjust category, or pick a date.
- Includes an explicit **"Clear Date"** action that safely returns the task to the **Undefined** column.

---

## 5. Responsive Strategy

- **Desktop (≥ 1024px):** Centered layout capped at `1360px` max-width. Prominent top input canvas with 4-column horizontal board below.
- **Mobile (< 768px):**
  - Full single-column view with a smooth horizontal tab selector for the 4 urgency columns (`Urgent`, `Upcoming`, `Backlog`, `Undefined`).
  - Sticky thumb-accessible Brain-Dump input bar.
  - All interactive elements strictly meet a minimum `48px` tap target.
  - Section wrapper uses `min-h-[100dvh]` to eliminate mobile browser viewport jumping.

---

## 6. Anti-Patterns & Slop Prevention

- **No Emojis:** Do not use emojis in UI controls, status badges, or headers. Use clean SVG geometry.
- **No Neon Glows:** No glowing purple borders, cyber gradients, or saturated cards.
- **No AI Marketing Clichés:** Eliminate filler copy ("Unleash your productivity", "Scroll to explore").
- **No Pure Black:** `#000000` is forbidden; use `#16171A`.
- **No Silent Degradation:** If both AI providers fail, show a calm, friendly retry message and preserve the user's typed input intact.
