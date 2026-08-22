# DESIGN_SYSTEM.md — Web App Design Tokens

Defines the visual language for `apps/admin`. Pairs with `UI_GUIDELINES.md` (how we build) — this doc is what things look like. Implemented via Ant Design's `ConfigProvider` theme tokens, per `UI_GUIDELINES.md` §9.

---

## 1. Design Intent

This is a tool HR staff and managers open dozens of times a day to make decisions involving people's pay, time, and status — it needs to read as **calm, precise, and trustworthy**, not playful or trend-driven. The signature idea: **status is never decorative here — every color used for state (attendance, leave, payroll) carries real meaning and is paired with a text label, never color alone** (this is both the accessibility rule from `UI_GUIDELINES.md` §10 and the design's organizing principle). The palette is deliberately restrained so that when something needs attention — a geofence violation, a pending payroll approval — it's immediately legible against a quiet baseline.

---

## 2. Color Palette

| Token | Hex | Usage |
|---|---|---|
| `color-ink-900` | `#1A2332` | Primary text, headings |
| `color-ink-600` | `#4A5568` | Secondary text, labels |
| `color-ink-300` | `#A0AEC0` | Placeholder text, disabled state |
| `color-surface` | `#FFFFFF` | Card/table backgrounds |
| `color-canvas` | `#F5F7FA` | App background |
| `color-border` | `#E2E8F0` | Dividers, table borders |
| `color-primary` | `#2C5545` | Primary actions, active nav, links — a deep pine/forest green, not a generic SaaS blue or a terracotta default |
| `color-primary-hover` | `#1F3E32` | Primary hover/pressed state |
| `color-primary-tint` | `#E4EDE8` | Selected row background, primary-tinted badges |
| `color-success` | `#2F855A` | Present, approved, paid, active statuses |
| `color-warning` | `#B7791F` | Late, pending, low-accuracy flags |
| `color-danger` | `#C53030` | Absent, rejected, geofence violation, locked account |
| `color-info` | `#2B6CB0` | Informational banners, on-leave status |
| `color-accent` | `#D4A24C` | Sparing use only — highlighting the single most important number on a dashboard summary card (e.g., "Payroll pending approval: 3") |

**Rationale:** A deep pine green as primary (rather than a default SaaS blue or the common AI-generated cream/terracotta pairing) reads as grounded and organizational without being cold. It's also distinct enough from the semantic `success` green that the two don't compete — primary is used for navigation/actions, success is used only for state.

---

## 3. Typography

| Role | Typeface | Notes |
|---|---|---|
| Display / Headings | **Source Serif 4** (weights 600–700) | Used only for page titles and section headers — a serif in an otherwise clean data-dense UI signals "this is a considered system of record," not a generic dashboard template. Used with restraint: never for body text, table content, or buttons. |
| Body / UI | **Inter** (weights 400–500) | All body text, table content, form labels, buttons — optimized for legibility at small sizes across data-heavy tables. |
| Numeric / Tabular | **Inter** with `font-variant-numeric: tabular-nums` | Applied specifically to any column of numbers (attendance days, salary figures) so digits align vertically for scannability — this matters a lot in payroll tables. |

### Type Scale

| Token | Size | Line Height | Usage |
|---|---|---|---|
| `text-display` | 28px | 36px | Page titles (Source Serif 4, 700) |
| `text-h2` | 20px | 28px | Section headers (Source Serif 4, 600) |
| `text-h3` | 16px | 24px | Card titles, table group headers (Inter, 600) |
| `text-body` | 14px | 22px | Default body/table text (Inter, 400) |
| `text-small` | 12px | 18px | Captions, helper text, badges (Inter, 400) |

---

## 4. Spacing

8px base unit, consistent across the app:

| Token | Value |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 16px |
| `space-4` | 24px |
| `space-5` | 32px |
| `space-6` | 48px |

- Table cell padding: `space-3` vertical isn't dense enough for long employee lists — use `space-2` vertical / `space-3` horizontal for table cells specifically, `space-3`/`space-4` for card content.

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Badges, tags, inputs |
| `radius-md` | 8px | Cards, modals, buttons |
| `radius-full` | 999px | Avatar images, status dots (paired with text label per §1) |

Deliberately not zero-radius/hairline-only (the "broadsheet" look) — soft, small radii keep the data-dense interface feeling approachable rather than severe, appropriate for a tool people use for personal/sensitive data like their own attendance and pay.

---

## 6. Status Badge Pattern (the signature element)

Every status across the app — attendance, leave, payroll — renders through one shared `<StatusBadge>` component with a consistent shape: **colored dot + text label**, never color alone (per §1, `UI_GUIDELINES.md` §10).

```
● Present     (color-success dot + text-small, color-ink-900)
● Late        (color-warning dot + text-small, color-ink-900)
● Absent      (color-danger dot + text-small, color-ink-900)
● On Leave    (color-info dot + text-small, color-ink-900)
● Regularized (color-primary dot + text-small, color-ink-900)
```

- Geofence violation is a **separate** indicator (a small outline/warning icon next to the location cell), not folded into the status dot — per `ATTENDANCE_LOGIC.md` §5, geofence validity and attendance status are tracked as distinct concerns, and the UI should reflect that separation rather than conflating them into one color.
- Payroll run status uses the same dot pattern: `draft` (ink-300), `pending_approval` (warning), `approved` (info), `disbursed` (success), `cancelled` (danger).

---

## 7. Elevation / Shadows

Minimal use — this is a data tool, not a marketing site. Two levels only:

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(26,35,50,0.06)` | Cards resting on canvas |
| `shadow-md` | `0 4px 12px rgba(26,35,50,0.12)` | Modals, dropdowns, popovers |

---

## 8. Iconography

- **Lucide icons** (already available per `packages/shared` / React ecosystem conventions in `ARCHITECTURE.md`) — consistent stroke width (1.5px), no mixing icon sets.
- Icons always paired with a text label for any action beyond the most universally recognized (search, close) — per the accessibility principle in §1/§6, this app doesn't rely on icon-only meaning for anything status- or action-related.

---

## 9. Motion

- Kept minimal and functional, not decorative — this is a tool for quick, repeated daily use, not a showcase.
- Standard transition: `150ms ease-out` for hover/focus states, `200ms ease-out` for modal/drawer enter.
- Table row updates (e.g., a live attendance status changing via WebSocket, per `API_GUIDELINES.md` §13) get a brief highlight-fade (background flashes `color-primary-tint` then fades over 600ms) so HR notices the change without a jarring re-render.
- Respect `prefers-reduced-motion` — disable the highlight-fade and reduce all transitions to near-instant when set (`UI_GUIDELINES.md` §10).

---

## 10. Ant Design Theme Token Mapping

For implementation in `ConfigProvider`:

```ts
{
  token: {
    colorPrimary: '#2C5545',
    colorSuccess: '#2F855A',
    colorWarning: '#B7791F',
    colorError: '#C53030',
    colorInfo: '#2B6CB0',
    colorTextBase: '#1A2332',
    colorBgBase: '#FFFFFF',
    colorBgLayout: '#F5F7FA',
    colorBorder: '#E2E8F0',
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, sans-serif",
  }
}
```

Headings (`text-display`, `text-h2`) are applied via a targeted CSS override on Ant's `Typography.Title` for the serif treatment, since Ant's theme tokens apply one font family globally — see `UI_GUIDELINES.md` §9 for the "theme tokens over ad hoc CSS" rule; this is the one deliberate, documented exception.

---

## 11. Dark Mode

🔶 Not in v1 scope per current `PRD.md` — if added later, token names above are structured to map to a dark equivalent set (`color-ink-900` inverting to a near-white on dark canvas, etc.) without renaming, but actual dark values are undefined until scoped.

---

## 12. Open Items

- [ ] Confirm Source Serif 4 licensing/self-hosting approach vs. Google Fonts CDN load (performance consideration for admin bundle)
- [ ] Validate color contrast ratios (WCAG AA minimum) for all text/background pairs above before implementation — especially `color-warning` and `color-accent` on `color-surface`
- [ ] Dark mode scoping decision (§11)
