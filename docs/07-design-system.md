# 07 — Design system (audit + style guide)

Written 2026-07-29 after a code-level UI/UX audit, requested because
the app's scope has grown a lot (10-phase roadmap + a 7-feature
follow-on round) while the visual design has only ever been extended
additively, never revisited as a whole. This doc is the shared
reference future page-restructure work should follow. It does **not**
change any existing page's behavior or appearance — see "What changed
in this pass" at the bottom for the exact (small, additive) diff.

## Why this exists

`docs/design/` has exactly two mockup files
(`ananas_dashboard.html`, `exam_ui.html`) from the original v1 build.
Everything since — messaging, doubts, homework, rank/badges, stars,
wellbeing, certificates, notifications, and the whole "understand/
motivate students better" feature round — was built by extending
existing CSS classes via engineering judgment, never against a fresh
visual design. That's why `dashboard.css`'s last dated section comment
is `/* Rank & Badges (Phase 10) */`, despite a dozen features shipping
after it: they all reused `.feed-card`/`.feed-item` or reached for
inline `style={{...}}` (353 uses across 74 files) rather than adding
named CSS. Strong reuse discipline, but no deliberate visual language
for most of what the app now does.

## Audit findings

1. **Page bloat** — `/teacher/students/[studentId]` is 19 stacked
   sections in one flat scroll (DNA summary, doubts, profile info,
   password reset, stat tiles, rank/badges, a full attendance heatmap
   since join date, exam trend, topic breakdown, journal timeline,
   wellbeing history, live activity, session history, screen-view
   panel, saved recordings, journal entry form, journal audit history).
   `/student/progress` and `/teacher/console` are headed the same way.
   **Not addressed in this pass** — restructuring these pages (tabs /
   jump-nav / progressive disclosure) is deliberately future work, once
   the primitives below exist to build it with.
2. **Nav growth** — 10 flat student nav items, 8 teacher, no grouping.
   Same status: documented, not restructured yet.
3. **One generic container for 14+ different content types** —
   `.feed-item` renders messages, doubts, at-risk flags, most-improved
   entries, study-buddy suggestions, activity log lines, recordings,
   journal entries, and notifications identically. An urgent message
   and a routine activity-log line look the same. Addressed below via
   opt-in weight modifiers.
4. **Inline-style drift** — 353 `style={{...}}` uses vs. the stated
   "plain global CSS only" convention. Root cause, not itself fixed
   here (would mean touching 74 files); the spacing/radius scale below
   exists so new code has a real alternative to reach for.
5. **Inconsistent breakpoints** — four different values across three
   files with no shared reference. Documented below, not unified yet
   (unifying `exam.css`'s one-off `800px` changes real page behavior,
   left for when that file is next touched for its own reasons).
6. **Thin token set** — ~12 colors, no spacing/radius scale, `--gold`
   doing double duty as both generic accent and achievement color.
   Spacing/radius scales added below; color reuse is intentional and
   left as-is (this app's whole "gold = achievement" convention
   depends on it staying a small, deliberately reused palette, not
   growing a color per feature).

## The scale (new tokens, `src/styles/tokens.css`)

### Spacing
An 8px-based progression. **New code should reach for these instead of
a fresh ad-hoc pixel value.** Existing inline styles are not being
retrofitted — this is additive, not a rename.

| Token | Value | Rough usage |
|---|---|---|
| `--space-1` | 4px | icon-to-label gaps, tight accents |
| `--space-2` | 8px | small internal padding |
| `--space-3` | 12px | default flex/grid gap |
| `--space-4` | 16px | card internal padding, section gaps |
| `--space-5` | 24px | between major page sections |
| `--space-6` | 32px | large section breaks |
| `--space-7` | 48px | page-level top/bottom breathing room |

### Radius
Names the values `.card`/`.chip`/nav rows already use — verified
against `globals.css`/`shell.css` before choosing these, not invented
fresh:

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 8px | small interactive elements (icon buttons) |
| `--radius-md` | 12px | nav rows, list rows |
| `--radius-lg` | 18px | cards (`.card`'s existing value) |
| `--radius-pill` | 999px | avatars, pill badges |

### Breakpoints (documented reference, not a live CSS token)
CSS custom properties can't be used inside `@media` conditions, so
this is a canonical table to copy values from, not a working variable:

| Name | Value | Meaning | Current usage |
|---|---|---|---|
| `--bp-mobile` | 560px | grids collapse to 1 column | `dashboard.css` |
| `--bp-nav` | 840px | sidebar swaps to `MobileNav` | `shell.css` |
| `--bp-tablet` | 980px | wider grids collapse | `dashboard.css` |

`exam.css`'s `800px` is a known one-off outside this set — left alone
until that file is next touched for unrelated reasons, rather than
risking an unrelated visual change to the exam-taking flow in a
design-audit pass.

## Feed-item weight variants

Three levels for the shared `.feed-item` row, opt-in via a modifier
class — `routine` is simply the existing look (no class needed):

```html
<div class="feed-item">...</div>                  <!-- routine (default, unchanged) -->
<div class="feed-item weight-important">...</div>  <!-- gold left-border -->
<div class="feed-item weight-urgent">...</div>     <!-- coral left-border + tinted background -->
```

Reuses the existing coral/gold palette — no new colors. **Not yet
adopted by any component.** Suggested first candidates, when that
page work happens: `weight-urgent` for the highest urgency level in
`MessageCard`/inbox, `weight-important` for `AtRiskStudentsCard` rows.
Routine-weight content (activity logs, recordings, most-improved,
study-buddy) should generally stay unmodified — not everything needs
to shout.

## What changed in this pass

Purely additive, zero risk to any existing page:
- `src/styles/tokens.css` — new spacing/radius/weight-color tokens +
  a documented (non-functional) breakpoint reference table.
- `src/styles/dashboard.css` — two new opt-in `.feed-item` modifier
  classes. No existing class was renamed or removed; no component was
  changed to use the new classes.

Nothing else changed. No page, component, or test is affected —
confirmed via `tsc --noEmit` and the full `npm test` suite staying
green (same counts as before this pass, since no logic changed).

## Suggested next steps (not started)

In roughly the order discussed:
1. Adopt the weight variants in 1-2 real components (start with
   `AtRiskStudentsCard` and the messages inbox) to prove them out
   before touching everything else.
2. Restructure the two mega-pages (`/teacher/students/[studentId]`,
   `/student/progress`) into tabs or a jump-nav, using the spacing
   scale for consistent section rhythm.
3. Group the sidebar nav once a restructuring pass is underway anyway.
4. Opportunistically migrate inline `style={{...}}` layout code to the
   new spacing tokens as each page is touched for other reasons — not
   a dedicated sweep.
