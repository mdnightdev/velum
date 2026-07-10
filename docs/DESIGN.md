Velum Design System (v2.1)

This document is the absolute design authority for Velum. Every visual decision—color, spacing, typography, component pattern—is defined here as a token.
Components reference tokens exclusively. Raw hex codes, arbitrary pixel values, and unapproved font stacks are forbidden.

---

1. Design Tokens (Tailwind v4 @theme)

Place this block in your global CSS file (src/index.css). It is the single source of truth for all styling.

```css
@import "tailwindcss";

@theme {
  /* ---- Neutral Scale (warm charcoal) ---- */
  --color-velum-900: #08090C;   /* canvas (deepest background) */
  --color-velum-850: #0C0E12;   /* sidebars, drawers, overlays */
  --color-velum-800: #101218;   /* elevated surfaces (cards, panels) */
  --color-velum-750: #15171E;   /* inputs, modals, footer cards */
  --color-velum-700: #1A1D24;   /* hover state for cards/rows */
  --color-velum-600: #22262E;   /* subtle borders and dividers */
  --color-velum-500: #2E323B;   /* muted separators, disabled states */

  /* ---- Primary Accent (rose gold) ---- */
  --color-accent:        #C89B8A;
  --color-accent-10:     rgba(200, 155, 138, 0.1);
  --color-accent-20:     rgba(200, 155, 138, 0.2);
  --color-accent-40:     rgba(200, 155, 138, 0.4);
  --color-accent-hover:  #D9AFA0;   /* brighter variant for hover */

  /* ---- Secondary Accent (muted teal) ---- */
  --color-accent-secondary:        #5B9A8B;
  --color-accent-secondary-10:     rgba(91, 154, 139, 0.1);
  --color-accent-secondary-20:     rgba(91, 154, 139, 0.2);

  /* ---- Text ---- */
  --color-text-primary:    #F5F2EB;   /* warm ivory – high contrast */
  --color-text-secondary:  #9B9790;   /* muted sand – labels, descriptions */
  --color-text-disabled:   #5A5550;   /* disabled or placeholder text */

  /* ---- Status Indicators (standard) ---- */
  --color-status-online:    #10B981;
  --color-status-away:      #F59E0B;
  --color-status-dnd:       #F43F5E;
  --color-status-invisible: #71717A;

  /* ---- Opacity Overlays (white / black) ---- */
  --color-white-2:   rgba(255, 255, 255, 0.02);
  --color-white-5:   rgba(255, 255, 255, 0.05);
  --color-white-10:  rgba(255, 255, 255, 0.1);
  --color-black-40:  rgba(0, 0, 0, 0.4);
  --color-black-60:  rgba(0, 0, 0, 0.6);

  /* ---- Typography ---- */
  --font-sans:    'Satoshi', 'Poppins', system-ui, sans-serif;
  --font-admin:   'Manrope', 'Satoshi', system-ui, sans-serif;
  --font-mono:    'Fira Code', 'JetBrains Mono', monospace;
  --font-display: 'Poppins', 'Satoshi', system-ui, sans-serif;

  /* ---- Border Radius ---- */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  16px;
  --radius-xl:  24px;
}
```

---

2. Visual Identity

**Logo**

* Typographic mark: `font-display`, lowercase, semibold weight, `text-accent`.
* Graphic mark: Custom SVG — flowing smoke/veil wave, using `text-accent` for the core and `text-accent-secondary` for subtle secondary lines.
* Tagline: "Conversations that flow like a veil." – `text-text-secondary`, 12px, tracking 0.15em.
* Version tag: v2.1.0 in `font-mono`, 8px, `text-text-secondary`.

**Color Usage Rules**

* Background layers:
  * App chrome & deepest areas: `bg-velum-900`.
  * Sidebars, drawers, overlays: `bg-velum-850`.
  * Cards, elevated surfaces: `bg-velum-800`.
  * Input fields, modals, footer cards: `bg-velum-750`.
* Borders & Dividers:
  * Subtle separators between panels: `border-velum-600`.
  * Glassy card/panel edges: `border-white-5` or `border-white-10`.
* Text:
  * Primary content: `text-text-primary`.
  * Secondary metadata, labels: `text-text-secondary`.
  * Disabled/placeholder: `text-text-disabled`.
* Accent:
  * Use `bg-accent`, `text-accent` only for interactive elements (primary buttons, active nav items, notification badges).
  * Hover on accent buttons: `bg-accent-hover` or `brightness-110`.
  * Subtle accent backgrounds: `bg-accent-10`, `bg-accent-20`.
* Secondary Accent:
  * Admin dashboard highlights, data visualization sparks, secondary badges: `text-accent-secondary` / `bg-accent-secondary-10`.
  * Never use the secondary accent as a primary action color; it must not compete.
* Status Indicators:
  * Always use the predefined status tokens (`bg-status-online`, etc.) with a `w-2.5 h-2.5 rounded-full` base.
  * Surround with a `ring-2 ring-velum-900` for a floating effect on dark backgrounds.

---

3. Typography Pairings & Scale

| Context | Font Class | Typeface | Use Case |
|---|---|---|---|
| Chat messages, general UI body | `font-sans` | Satoshi | Default for all user-facing text |
| Admin panel, CLI console, tables | `font-admin` | Manrope | For data-dense interfaces |
| Monospace (keys, hashes, code) | `font-mono` | Fira Code | Always accompanied by `tracking-tight` |
| Brand titles, headings | `font-display` | Poppins | For H1–H3, login screen names, top-level brand |

Size scale (strict, no arbitrary values): 10px, 11px, 12px, 14px, 16px, 18px, 20px, 24px, 30px, 36px.
Use Tailwind classes: `text-[10px]` through `text-3xl`. Smaller than 10px is forbidden.

**Weight usage**

* Headers: `font-semibold`.
* Body: `font-normal`.
* Subtle labels: `font-medium`.
* Monospace: `font-normal` or `font-medium`.

**Letter spacing**

* Uppercase trackers: `tracking-wider`, `tracking-widest`.
* Monospace: `tracking-tight`.
* Brand labels: `tracking-[0.2em]` (only where explicitly specified in the brand block).

---

4. Responsive Layout Architecture

**Desktop & Tablet (≥768px)**

* Three-column persistent grid:
  * Left navigation rail: `w-16 bg-velum-850 border-r border-velum-600`. Icon-only navigation.
  * Secondary directory sidebar: `w-72 bg-velum-850 border-r border-white-5`. Contains brand, tabs, recents, footer.
  * Core workspace: `flex-1 bg-velum-900`. Holds active chat, settings content, or admin panels.
* Secondary panels (drawers): slide in from the right (`w-80`), with `bg-velum-850 border-l border-white-5`. Overlay behind: `bg-black-40 backdrop-blur-sm`.
* Admin panel: Full-screen flex column, no left navigation rail. Uses `font-admin`, dense data grids, and a command palette accessible via Cmd+K.

**Mobile (<768px)**

* Single-column sliding deck: Three full-width panels (Navigation, Directory, Workspace) inside a `w-[300vw]` container, translated horizontally with `transform translateX` and `duration-200 ease-out`.
* Bottom navigation dock: `fixed bottom-0 h-16 bg-velum-850 border-t border-white-5 w-full flex justify-around items-center`.
  * 5 tabs: Home, People, Lounge, Chats, Profile.
  * Active tab: `text-accent` with a `w-1 h-1 rounded-full bg-accent` indicator dot below.
  * Inactive tabs: `text-text-secondary`.
  * Minimum touch area: 44px × 44px (icons padded to `p-3`).

---

5. Component Recipes

All components must use these exact token classes. Deviations require updating this document.

| Component | Base Classes | Interactive States |
|---|---|---|
| Primary Button | `bg-accent text-velum-900 font-semibold rounded-md px-4 py-2 transition-all duration-150` | `hover:bg-accent-hover active:scale-[0.98] focus:ring-2 ring-accent-20` |
| Secondary Button | `border border-accent-20 text-accent rounded-md px-4 py-2 transition-colors duration-150` | `hover:bg-accent-10 active:scale-[0.98] focus:ring-2 ring-accent-20` |
| Card | `bg-velum-800 border border-white-5 rounded-lg p-4` | `hover:bg-velum-700 transition-colors duration-150` (if interactive) |
| Input Field | `bg-velum-750 border border-velum-600 rounded-md px-3 py-2 text-text-primary placeholder:text-text-disabled` | `focus:border-accent-40 focus:ring-2 ring-accent-20 outline-none` |
| Modal Overlay | `fixed inset-0 bg-black-60 backdrop-blur-sm z-50` | — |
| Modal Panel | `bg-velum-850 border border-white-10 rounded-xl p-6 max-w-lg w-full shadow-2xl` | — |
| Settings Drawer | `fixed inset-0 z-[99999]`; backdrop `absolute inset-0 bg-black-60 backdrop-blur-sm`; panel `w-full h-full bg-velum-850 border-r border-accent-10` (left nav: `w-72 bg-velum-800 border-r border-white-5`; right content: `flex-1 bg-velum-850 p-8`) | — |
| Badge (primary) | `bg-accent-10 text-accent text-xs font-medium px-2 py-0.5 rounded-full` | — |
| Badge (secondary) | `bg-accent-secondary-10 text-accent-secondary text-xs font-medium px-2 py-0.5 rounded-full` | — |
| Status Dot | `w-2.5 h-2.5 rounded-full ring-2 ring-velum-900` | Use `bg-status-*` tokens |
| Sidebar Footer Card | `p-3 bg-velum-800 border border-white-5 rounded-xl` | — |
| Chat Bubble (sent) | `bg-accent text-velum-900 rounded-2xl rounded-br-md px-4 py-2 max-w-[75%] self-end` | — |
| Chat Bubble (received) | `bg-velum-800 text-text-primary rounded-2xl rounded-bl-md px-4 py-2 max-w-[75%] self-start` | — |
| Navigation Rail Icon | `w-6 h-6` (default: `text-text-secondary`; active: `text-accent`) | `hover:text-accent transition-colors duration-150` |
| Empty State | Centered column: custom SVG illustration, `text-text-secondary` descriptive text, single primary button. No lorem ipsum, no emojis. | — |
| Skeleton Loader | `bg-velum-700 animate-pulse rounded-md` (use the component's own border radius token) | — |
| Error Inline Text | `text-status-dnd` with a small AlertCircle icon from lucide-react | — |

---

6. Iconography

* Library: lucide-react only.
* Sizes:
  * Inline with text: `w-4 h-4`.
  * Standard navigation/badge: `w-5 h-5`.
  * Navigation rail: `w-6 h-6`.
  * Large feature icons: `w-8 h-8`.
* No other icon sets permitted.

---

7. Interaction & Motion

* Transitions:
  * Color changes, backgrounds: `duration-150 ease-out`.
  * Opacity, visibility: `duration-200`.
  * Panel slides, drawer open/close: `duration-200 ease-out` with appropriate transform.
* Scale on press: `active:scale-[0.98]` for buttons and interactive cards.
* Hover lift (cards): `hover:shadow-lg hover:shadow-black/20 transition-shadow duration-150`.
* Focus rings: Use `ring-2 ring-accent-20` for all interactive elements (inputs, buttons, toggles). Never remove focus outlines without providing an alternative.
* Loading: Skeleton screens (no spinners for full-page loads). Spinners allowed only for inline async actions (e.g., button loading state).

---

8. Accessibility (WCAG AA reference)

Measured contrast ratios for this palette, so implementers don't have to guess:

| Pairing | Ratio | WCAG AA (normal text, 4.5:1) |
|---|---|---|
| `text-text-primary` on `velum-900` | 17.8:1 | Pass |
| `text-text-primary` on `velum-800` | 16.7:1 | Pass |
| `text-text-secondary` on `velum-900` | 6.9:1 | Pass |
| `text-text-secondary` on `velum-800` | 6.4:1 | Pass |
| `text-text-secondary` on `velum-750` | 6.2:1 | Pass |
| `text-accent` on `velum-900` | 8.1:1 | Pass |
| `velum-900` text on `bg-accent` (primary button) | 8.1:1 | Pass |
| `text-accent-secondary` on `velum-900` | 6.1:1 | Pass |
| `status-dnd` on `velum-900` | 5.4:1 | Pass |
| `text-text-disabled` on `velum-750` | 2.4:1 | Fails AA — acceptable only because disabled/placeholder text is exempt from WCAG contrast requirements. Never use `text-text-disabled` for anything actionable or informational. |

Rules:

* Every text/background pairing used for real content or controls must hit at least 4.5:1 (normal text) or 3:1 (large text ≥24px / 18.66px bold). All pairings above except the disabled-text case already clear this — do not introduce new pairings without checking.
* `text-text-disabled` is reserved strictly for disabled states and placeholder copy, never for content the user needs to read.
* Focus rings (`ring-2 ring-accent-20`) must remain visible on every background layer (`velum-900` through `velum-750`) — do not suppress them.
* Do not rely on color alone to convey status: status dots pair with a label or icon wherever the state matters (e.g., error banners use `status-dnd` color plus the AlertCircle icon, not color alone).

---

9. Anti-Patterns & Forbidden Practices

* No neon glow, RGB borders, or cyberpunk effects.
* No hardcoded hex colors, RGB values, or arbitrary opacity modifiers (e.g., `bg-[#08090C]`, `border-white/[0.04]`). Use tokens only.
* No inline `style=` attributes — every style must come from Tailwind classes referencing tokens.
* No Bootstrap, Material UI, or Font Awesome classes.
* No pure black (`#000`) or pure white (`#fff`) for backgrounds or text — always use the defined neutral/text tokens.
* No `font-serif` — use `font-sans`, `font-admin`, `font-mono`, or `font-display`.
* No arbitrary text sizes — stick to the size scale defined in Section 3.
* No placeholders, lorem ipsum, or explanatory pseudo-labels in UI forms.
* No mock telemetry or decorative cards unless explicitly requested.

---

10. Design Authority

* Figma mockups are the absolute source of truth for layout, spacing, and component states. When a Figma link is referenced, implement exactly that — do not interpolate unrelated templates.
* This `DESIGN.md` overrides all earlier styling decisions. If a conflict arises between code and this document, this document wins.
* Tokens must be updated here before new visual patterns are introduced. Do not add new colors or font sizes directly in components.

---

End of Velum Design System v2.1
