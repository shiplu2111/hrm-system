# DESIGN_SYSTEM.md

## 1. Purpose

Shared design tokens and component conventions across the admin web app, employee web app, and mobile app, so the product feels like one system rather than three separately-designed apps.

**Source of truth:** token values are implemented in `apps/web/src/index.css` (CSS custom properties) and wired into Tailwind via `apps/web/tailwind.config.js`. Admin and other apps should converge on these values over time.

**Design intent:** professional HR/payroll admin — high information density, trustworthy, restrained. Avoid bright or playful colors on financial and payroll surfaces.

---

## 2. Design Tokens

### 2.1 Colors

#### Primary (`accent` / `primary` in Tailwind)

Deep trust blue — desaturated and corporate, suitable for payroll CTAs, links, and focus rings.

| Step | Hex | Use |
|------|-----|-----|
| 50 | `#eef2f6` | Subtle tinted backgrounds |
| 100 | `#d5dfe9` | Hover on tinted surfaces |
| 200 | `#adbfce` | Borders on tinted surfaces |
| 300 | `#859fb3` | Disabled primary text |
| 400 | `#5d7f98` | Secondary links |
| 500 | `#3d6580` | Icons, secondary actions |
| **600** | **`#1e4976`** | **Primary buttons, links, focus ring** |
| 700 | `#183c62` | Primary hover / pressed |
| 800 | `#122f4d` | Dark accents |
| 900 | `#0c2239` | Headings on tinted bg |
| 950 | `#061525` | Dark-mode tinted bg |

#### Secondary / Neutral (`secondary` / `neutral`)

Slate scale for chrome, secondary buttons, table headers, and dividers.

| Step | Hex | Use |
|------|-----|-----|
| 50 | `#f8fafc` | Lightest surface tint |
| 100 | `#f1f5f9` | Muted row backgrounds |
| 200 | `#e2e8f0` | Borders, dividers |
| 300 | `#cbd5e1` | Strong borders |
| 400 | `#94a3b8` | Placeholder text |
| 500 | `#64748b` | Captions |
| **600** | **`#475569`** | **Secondary button text** |
| 700 | `#334155` | Strong secondary text |
| 800 | `#1e293b` | Dark surfaces |
| 900 | `#0f172a` | Primary text (alt) |
| 950 | `#020617` | Deepest background |

#### Semantic surfaces (CSS variables)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg-base` | `#f4f7fa` | `#06101c` | Page canvas |
| `--bg-surface` | `#ffffff` | `#0c1929` | Cards, panels |
| `--bg-elevated` | `#ffffff` | `#12253a` | Popovers, dropdowns |
| `--bg-muted` | `#edf2f7` | `#12253a` | Table stripes, sidebars |
| `--bg-hover` | `#e5ebf2` | `#18304a` | Row / list hover |
| `--border-base` | `#dae2ea` | `#1e344b` | Default borders |
| `--border-strong` | `#c0cbd8` | `#2d4761` | Emphasized borders |
| `--text-primary` | `#0c1929` | `#f4f7fa` | Body text, headings |
| `--text-secondary` | `#485466` | `#94a3b8` | Labels, metadata |
| `--text-muted` | `#6b7785` | `#64748b` | Hints, disabled |
| `--text-inverse` | `#ffffff` | `#0c1929` | Text on primary buttons |

Use via utility classes: `bg-[rgb(var(--bg-surface))]` or component classes `.surface`, `.text-primary`, `.text-secondary`, `.text-muted`.

#### Success

Restrained emerald — approved, paid, present, finalized.

| Step | Hex | Use |
|------|-----|-----|
| 50 | `#ecfdf5` | Success background tint |
| 600 | **`#047857`** | **Badges, icons, success text** |
| 700 | `#065f46` | Success hover |

#### Warning

Muted amber — pending, draft, attention needed (not alarm).

| Step | Hex | Use |
|------|-----|-----|
| 50 | `#fffbeb` | Warning background tint |
| 600 | **`#b45309`** | **Badges, icons, warning text** |
| 700 | `#92400e` | Warning hover |

#### Danger / Error

Serious red — rejected, absent, overdue, validation errors.

| Step | Hex | Use |
|------|-----|-----|
| 50 | `#fef2f2` | Error background tint |
| 600 | **`#b91c1c`** | **Badges, icons, error text** |
| 700 | `#991b1b` | Error hover |

Tailwind aliases: `danger-*` maps to `error-*`.

---

### 2.2 Typography

**Font families**

| Role | Stack | Use |
|------|-------|-----|
| Sans | Inter, system-ui | All UI text |
| Mono | JetBrains Mono, ui-monospace | Payroll amounts, employee IDs, codes |

**Type scale** (compact — optimized for dense admin tables)

| Token | Size | Line height | Use |
|-------|------|-------------|-----|
| `text-2xs` | 11px | 16px | Table column headers, micro labels |
| `text-xs` | 12px | 16px | Captions, badge text |
| `text-sm` | 13px | 18px | **Default table cell text** |
| `text-base` | 14px | 20px | **Default body text** |
| `text-lg` | 16px | 24px | Subheadings, card titles |
| `text-xl` | 18px | 26px | Section headings |
| `text-2xl` | 20px | 28px | Page sub-title (h4) |
| `text-3xl` | 24px | 32px | Page title (h3) |
| `text-4xl` | 28px | 36px | Marketing / hero (h2) |
| `text-5xl` | 32px | 40px | Rare display (h1) |

**Heading mapping**

| Level | Classes | Weight |
|-------|---------|--------|
| h1 | `text-5xl font-semibold` | 600 |
| h2 | `text-4xl font-semibold` | 600 |
| h3 | `text-3xl font-semibold` | 600 |
| h4 | `text-2xl font-semibold` | 600 |
| h5 | `text-xl font-semibold` | 600 |
| h6 | `text-lg font-semibold` | 600 |
| body | `text-base font-normal` | 400 |
| caption | `text-xs font-medium` | 500 |

**Weights:** 400 regular · 500 medium (labels) · 600 semibold (headings, buttons) · 700 bold (emphasis only)

---

### 2.3 Spacing

4px base grid. Tailwind class = token name.

| Token | Value | Typical use |
|-------|-------|-------------|
| `0.5` | 2px | Icon–label micro gap |
| `1` | 4px | Inline spacing, badge padding-x |
| `2` | 8px | Input padding-y, compact gaps |
| `3` | 12px | Compact card padding, list item padding |
| `4` | 16px | Default card / modal padding |
| `5` | 20px | Form field groups |
| `6` | 24px | Section spacing |
| `8` | 32px | Page section gaps |
| `10` | 40px | Large section gaps |
| `12` | 48px | Page header margin |
| `16` | 64px | Layout gutters (wide screens) |

---

### 2.4 Border radius

Subtle corners — avoid heavy rounding on data-dense surfaces.

| Token | Value | Use |
|-------|-------|-----|
| `rounded-sm` | 4px | Inputs, badges, status pills |
| `rounded` / `rounded-md` | 6px | Buttons, dropdown items |
| `rounded-lg` | 8px | Cards, panels, tables |
| `rounded-xl` | 12px | Modals, large cards |
| `rounded-2xl` | 16px | Marketing only (rare in admin) |
| `rounded-full` | 9999px | Avatars, FAB |

---

### 2.5 Shadows

Low elevation — keeps focus on data, not chrome.

| Token | Use |
|-------|-----|
| `shadow-xs` | Flat inputs, inset-feel borders |
| `shadow-sm` / `shadow-card` | Cards at rest |
| `shadow-card-hover` | Hovered / selected cards |
| `shadow-md` | Dropdowns, popovers |
| `shadow-lg` / `shadow-elevated` | Modals, drawers |
| `shadow-xl` | Full-screen overlays |

Light-mode shadows use `rgb(12 25 41 / …)` (primary text hue) for a cool, neutral cast.

---

## 3. Component Library

- Web: shared component library (e.g. built on top of a base like Radix/shadcn, or a custom kit) used by both Admin and Employee web apps.
- Mobile: React Native equivalent component set, visually aligned to the web tokens but built natively for RN (not a webview).

## 4. Core Reusable Components

Button, Input, Select/Dropdown, Date Picker, Table (with sort/filter/pagination), Modal, Toast/Notification, Badge/Status Pill (for attendance/payroll/leave statuses — see UI_GUIDELINES.md §3 for status color mapping), Stepper/Timeline (for approval workflows), Card, Tabs.

## 5. Status Color Convention

Consistent mapping across payroll, leave, and attendance. Use semantic tints (50 bg + 600 text/border) for badges.

| Status | Color | Token examples |
|--------|-------|----------------|
| Draft, Pending, In review | Warning (amber) or Secondary | `bg-warning-50 text-warning-700`, `bg-secondary-100 text-secondary-700` |
| In review (active) | Primary (blue) | `bg-accent-50 text-accent-700` |
| Approved, Finalized, Present, Paid | Success | `bg-success-50 text-success-700` |
| Rejected, Absent, Overdue, Failed | Danger | `bg-error-50 text-error-700` |
| Neutral / Archived / Cancelled | Secondary | `bg-secondary-100 text-secondary-600` |

## 6. Accessibility

- Minimum contrast ratios (WCAG AA) for all text/background combinations. Primary `#1e4976` on white ≥ 7:1; body text `#0c1929` on `#f4f7fa` ≥ 12:1.
- All interactive elements keyboard-navigable on web; focus ring uses `ring-focus` (`accent-600`).
- Adequate touch target size on mobile (minimum 44×44px).

## 7. Responsive Behavior (Web)

- Admin web app: desktop-first, must remain usable at tablet width for managers approving requests on the go.
- Employee web app (if offered alongside the mobile app): mobile-responsive by default.

## 8. Ownership

- This file is the living reference for design decisions. Update it when tokens change in `apps/web/src/index.css`.
