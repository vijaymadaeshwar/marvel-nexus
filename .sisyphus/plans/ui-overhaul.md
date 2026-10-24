# UI Overhaul Plan — Marvel Nexus

## Overview
Three workstreams: (1) header + button redesign, (2) cast panel visual rework, (3) remove cards feature entirely. All changes are HTML + CSS only (except cards removal which touches JS and sw.js).

---

## 1. Remove Cards Feature

### HTML — `index.html`
- **Delete lines 276**: Cards button in feature dock
- **Delete lines 457–480**: Entire `<aside class="cards-panel">` block

### CSS — `css/style.css`
- **Delete lines 7995–8230**: All `.cards-*` rule blocks (panel, search, filters, grid, cards, empty, foot)
- **Delete lines 9125–9126**: `.cards-panel__head h2` override
- **Delete lines 9138–9139**: `.cards-panel__eyebrow` override  
- **Delete lines 9201–9202**: `.cards-search:focus-within` override
- **Delete lines 9215–9216**: `.cards-filter.is-active` override
- **Delete line 9284**: `.cards-filter:active` in press feedback

### JS — `js/nexus-cards.js`
- **Delete entire file** (or empty it to a no-op stub)

### JS — `js/app.js`
- Remove `NexusCards` reference if any (search for `NexusCards` / `Cards`)

### Service Worker — `sw.js`
- **Delete line 18**: `"./js/nexus-cards.js"` from SHELL cache array
- Bump `CACHE_NAME` from `v42` to `v43`

---

## 2. Header Redesign

### Design Language
- **Glass morphism**: frosted-glass header with subtle blur + gradient border
- **Typography**: larger, bolder brand title with gradient text
- **Buttons**: unified pill/chip style with consistent sizing, glow on active states
- **Layout**: tighter vertical rhythm, clear visual hierarchy

### HTML Changes — `index.html` (lines 73–157)
Restructure the header into cleaner visual groups:

**Before**: brand + tagline → controls → tools → era → pathway (dense, flat)
**After**: brand row → search/sort row → filter row → pathway row (visual layers)

Add subtle visual separators between groups. No structural HTML changes needed — just CSS restyling of existing elements.

### CSS Changes — `css/style.css`

#### Header container
Replace `.app-header` base (lines 128–144):
- Add `border-bottom: none` (use the `::after` gradient line instead)
- Enhance backdrop: `backdrop-filter: blur(20px) saturate(180%)`
- Add subtle top border glow: `box-shadow: inset 0 1px 0 rgba(61,220,132,.12), 0 4px 30px rgba(0,0,0,.25)`
- Add inner glow band at bottom via `::before` pseudo-element

#### Brand
Enhance `.brand-text h1` (lines 9081–9091):
- Keep existing gradient text (it's already premium)
- Bump letter-spacing and add `text-transform: uppercase` for stronger presence
- Add subtle text-shadow glow

#### Sort toggle
Restyle `.sort-toggle` + `.sort-btn` (lines 254–281):
- Slightly taller buttons (min-height: 34px)
- Active state: solid emerald gradient with glow
- Add subtle inner shadow on the container

#### Universe picker + Route filter
Restyle `.universe-picker__trigger` + `.route-filter` (lines 380–433):
- Consistent height (min-height: 34px)
- Add icon/indicator for dropdowns
- Hover: border glow
- Focus: brighter ring

#### Pathway buttons
Enhance `.pathway-btn` (lines 6302–6321):
- Larger font (11px), bolder weight
- Active: animated gradient background with glow pulse
- Inactive: subtle glass background

#### Chips (Films/Series/All) + Unwatched toggle
Enhance `.chip-filter` + `.chip-toggle` (lines 6328–6376):
- Consistent sizing with pathway buttons
- Active: emerald border + glow
- Unwatched: accent color when checked

#### Theme toggle
Enhance `.theme-toggle__btn` (lines 4422–4446):
- Slightly larger, add subtle hover gradient
- Active: purple glow consistent with other active states

#### Experience buttons (sound, gauntlet)
Enhance `.experience-btn` (lines 4449–4491):
- Consistent pill shape with other header buttons
- Hover: upward lift + glow
- Active: golden glow

#### Global button polish
Add at end of file:
- Consistent `transition` on all interactive header elements
- Unified `:hover` lift effect (`translateY(-1px)`)
- Unified `.is-active` glow pattern (emerald for primary, purple for secondary, gold for experience)
- Add subtle `box-shadow` animation on active states

#### Visual group separators
Add CSS-only separators between header sections:
- `.timeline-tools`: subtle top border or spacing increase
- `.era-bar`: slightly muted background band
- `.pathway-bar`: bottom border glow

---

## 3. Cast & Characters Panel Redesign

### Current: list-based entries with thumbnails
### New: card-grid mosaic layout

### HTML Changes — `index.html` (lines 297–313)
No structural changes needed — the cast panel HTML is data-driven via JS. Only CSS changes.

### CSS Changes — `css/style.css`

#### Cast panel container
Restyle `.cast-panel` (lines 2134–2163):
- Wider panel (min-width: 480px)
- Glass morphism background
- Smoother open/close transitions

#### Cast list → card grid
Replace `.cast-list` (line 2242) with:
```css
.cast-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  scrollbar-width: thin;
}
```

#### Cast entry → card
Restyle `.cast-entry` (lines 2247–2310):
- Card appearance: `background: var(--bg-panel-2)`, `border-radius: 14px`, `border: 1px solid var(--border)`
- Thumbnail: larger, centered, rounded (60×80px)
- Names/meta: centered below thumbnail
- Hover: border glow + slight lift + shadow
- Active: emerald accent border

#### Cast thumb
Restyle `.cast-thumb` (lines 2262–2296):
- Larger size (60×80px)
- Rounded corners (12px)
- Shadow on hover
- Monogram: larger font, gradient background

#### Detail cast (in detail panel)
Restyle `.detail-cast__item` (lines 3980–4045):
- Card-style items with thumbnails
- Horizontal layout: thumb + info + badges
- Hover: subtle glow

#### Cast tabs
Enhance `.cast-tabs button` (lines 3715–3737):
- Pill-style tabs with active indicator
- Smooth transition between views

#### Network/Connections views
Minor polish:
- Better node styling in `.net-node--char`
- Improved connection card layout

---

## 4. Global UI Polish

### Add at end of CSS (before closing):
- Consistent focus-visible rings on all interactive elements
- Smooth scroll behavior on panels
- Refined scrollbar styling (thin, themed)
- Subtle entrance animations for panels (fade + slide)
- Better empty states with larger typography

### Typography hierarchy:
- Panel titles: `font: 700 24px var(--font-display)` with gradient text
- Panel subtitles: `font: 500 12px var(--font-ui)` in `var(--text-dim)`
- Body content: consistent `11–12px` sizing

---

## Execution Order
1. Remove cards feature (HTML → CSS → JS → SW)
2. Header redesign (CSS only, iterative)
3. Cast panel redesign (CSS only)
4. Global polish pass
5. Verify all panels still open/close correctly
6. Gate suite verification

## Verification
- All panels open/close (variant, playhead, optimizer, stats, achievements, commute, villains, credits, eggs, share, nostalgia, surprise, cast)
- Cards button and panel completely gone
- Header looks polished on desktop + mobile
- Cast panel shows card grid layout
- All existing functionality preserved
- v2-harness 128/128, features-smoke 5/5, nexus-check 77/77 (cards-related checks will be removed from harness)
