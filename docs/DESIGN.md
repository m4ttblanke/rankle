# DESIGN.md

This document is the source of truth for the application's visual and interaction design.

Read this file before:

- Creating a major user-facing screen
- Redesigning an existing screen
- Adding new visual patterns
- Changing typography, colors, spacing, radius, motion, or core components

Do not use this file as a dumping ground for every CSS value.

Document reusable design decisions that should remain consistent across the product.

---

## 1. Design Goal

The application should feel like a polished daily consumer game.

It should be:

- Immediate
- Opinionated
- Social
- Playful
- Clean
- Fast
- Distinctive

It should not feel like:

- A SaaS dashboard
- A generic startup template
- A shadcn demo
- A productivity app
- A component-library showcase
- Generic AI-generated UI

The product should feel more visually sophisticated than its architecture.

---

## 2. Primary Visual Idea

The tier-list board is the product's visual center.

The strongest visual identity should come from:

- Tier rows
- Rankable cards
- Movement between tiers
- Result reveals
- Disagreement with friends/community

Spend visual boldness here.

Keep surrounding UI more restrained.

---

## 3. Design Source Priority

When design guidance conflicts:

1. Explicit user direction
2. This `DESIGN.md`
3. Accessibility and functional correctness
4. Existing established components
5. Anthropic Frontend Design
6. Interface Design
7. Vercel Web Design Guidelines
8. UI/UX Pro Max
9. 21st.dev/community components

Do not allow external tools to silently redefine the visual system.

---

## 4. Design Tool Roles

### Anthropic Frontend Design

Use for creative direction and major consumer-facing interfaces.

### Interface Design

Use for product/interface craft, hierarchy, spacing, and consistency.

### Scroll Craft

Use primarily for the public landing page and scroll-driven storytelling.

### Vercel Web Design Guidelines

Use as an audit step after meaningful frontend work.

### UI/UX Pro Max

Use selectively for research and exploration.

### shadcn MCP

Use for conventional primitives.

### 21st.dev

Use selectively for inspiration or higher-level component references.

Adapt external components to this design system.

---

## 5. Avoid Generic AI Aesthetics

Do not automatically reach for:

- Purple gradients
- Giant gradient headlines
- Excessive glow
- Glassmorphism everywhere
- Oversized rounded cards
- Every element inside a bordered card
- Excessive pills
- Identical three-column feature grids
- Decorative charts with no product value
- Random soft shadows
- Overly verbose marketing copy

These techniques are not forbidden.

Use them only when they reinforce the established design direction.

---

## 6. Typography

Typography should feel confident and consumer-oriented.

Use:

- A distinctive display treatment for important game/marketing moments
- A highly readable interface typeface for controls and body text

Avoid excessive font variety.

Recommended hierarchy:

- Hero/display
- Page title
- Section title
- Body
- Supporting/meta
- Button/control

Once the final font choices are established, record them here.

### Current Font Decisions

Decided in Milestone 1 (Step 2). Loaded via `next/font/google` in `app/layout.tsx`
(self-hosted by Next at build time — no runtime request to Google, no layout
shift). Exposed as CSS variables and Tailwind utilities.

- **Display: Bricolage Grotesque** — `--font-display` / `font-display` utility.
  Weights 600/700/800. A contemporary display grotesque with deliberate
  "imperfect" details: playful and crafted without being childish, which
  matches the tactile, approachable feel the tier board and cards need.
  Use for game moments only: hero/marketing headlines, tier letters, big
  result-reveal numbers, section titles. Not for body copy.
- **Interface / body: Hanken Grotesk** — `--font-sans` / default `font-sans`.
  Weights 400/500/600/700. A friendly, highly readable neutral workhorse
  (not Inter/Roboto/system). Use for everything else: body, controls,
  labels, metadata.

Because display/body contrast is subtler than a serif+sans pairing, hierarchy
leans on **size, weight, and the type scale** — keep that contrast deliberate.

Do not introduce additional fonts without a clear reason.

---

## 7. Color

Use a small neutral foundation plus strong tier colors.

The UI should remain readable even when tier colors are visually prominent.

All colors are **OKLCH** (supported by every Next.js 16 target browser).
Defined on `:root` in `app/globals.css` and mapped to Tailwind utilities via
`@theme inline`. **Light mode only for MVP**; every token lives on `:root` so a
dark theme can be added as an override block with no restructuring (see
`app/globals.css` bottom note, and section 8).

### Base Tokens

Established in Milestone 1 (Step 2). Neutrals are warm-tinted; no pure black or
pure white. The accent is a magenta-crimson chosen to sit **outside** the S–D
hue ramp so primary actions never read as a tier.

```text
--background:         oklch(0.985 0.006 95)   warm paper
--foreground:         oklch(0.22  0.02  60)   warm near-black ink
--surface:            oklch(0.995 0.004 95)   cards / raised
--surface-muted:      oklch(0.96  0.008 95)   unranked pool / recessed
--border:             oklch(0.90  0.01  95)   hairline
--muted:              oklch(0.50  0.02  60)   secondary / meta text
--accent:             oklch(0.55  0.21  350)  primary action
--accent-foreground:  oklch(0.99  0.01  350)
```

### Tier Tokens

**Provisional** — meet WCAG AA (verified by `lib/design/contrast.test.ts`) and
will be visually reviewed and finalized once the first tier board exists. Each
tier has three tokens: `fill`, `foreground` (the letter label on the fill), and
`border` (the row outline / drop-target edge).

```text
         fill                      foreground                border
--tier-s  oklch(0.55 0.20 25)   oklch(0.99 0.02 25)   oklch(0.42 0.17 25)   red
--tier-a  oklch(0.62 0.16 50)   oklch(0.21 0.03 50)   oklch(0.45 0.13 50)   orange
--tier-b  oklch(0.80 0.14 85)   oklch(0.26 0.04 85)   oklch(0.52 0.12 85)   amber
--tier-c  oklch(0.54 0.14 150)  oklch(0.99 0.02 150)  oklch(0.40 0.11 150)  green
--tier-f  oklch(0.52 0.13 245)  oklch(0.99 0.02 245)  oklch(0.40 0.11 245)  blue
```

`N/A` ("haven't tried") intentionally has NO row here. It is an opinion
abstention, not a bad opinion, so it must not look worse than F — it gets
`tierStyle`'s NEUTRAL fallback (`--surface-muted` / `--foreground` / `--border`)
instead of a spot on this ramp.

Tier colors must remain distinguishable and accessible.

Do not rely on color alone to communicate tier identity: the board always
renders the **tier letter** and the **`--tier-*-border` outline** alongside the
fill. `lib/design/contrast.test.ts` enforces label-on-fill ≥ 4.5:1 and
outline-on-background ≥ 3:1 for every tier.

---

## 8. Light and Dark Mode

Support both only if it can be done consistently without slowing core product development.

If dark mode is implemented:

- Maintain tier distinction
- Maintain text contrast
- Avoid turning every surface into glowing glass
- Test result visualizations in both modes

If only one theme exists initially, that is acceptable.

---

## 9. Spacing

Use consistent spacing rather than arbitrary values.

Prioritize:

- Clear separation between major sections
- Comfortable touch spacing
- Dense enough tier rows to fit the game without feeling cramped
- Generous breathing room on marketing pages

Do not make the application feel like a dashboard full of separated cards.

---

## 10. Radius

Use a restrained radius system.

Rankable cards can have enough radius to feel tactile and approachable.

Avoid making every surface extremely rounded.

### Current Radius Scale

Established in Milestone 1 (Step 2). In `app/globals.css`, mapped to Tailwind
`rounded-sm/md/lg/xl`.

```text
--radius-sm:  0.375rem  (6px)   chips, small controls
--radius-md:  0.625rem  (10px)  buttons, inputs
--radius-lg:  0.875rem  (14px)  rankable cards (the most tactile surface)
--radius-xl:  1.25rem   (20px)  sheets, large surfaces
```

---

## 11. Borders and Shadows

Prefer subtle structure.

Use borders for:

- Separation
- State
- Focus
- Drop targets

Use shadows sparingly.

A rankable item may feel physically elevated while dragging.

Do not give every static component a shadow.

---

## 12. Tier Board

The tier board should immediately communicate how to play.

Each tier row should have:

- Clear tier label
- Distinct tier color
- Obvious drop area
- Sufficient height for touch
- Clear empty state

The unranked area should clearly differ from final tiers.

Avoid excessive instructions if the interaction can explain itself.

### As built (Milestone 2)

- Each tier lane = a bold `--tier-*` letter chip + a lane carrying a **whisper
  wash** of that tier's colour (`tierStyle(label).lane`, ~5–6% tint). The board
  reads as a board, not a table.
- The unranked pool is visually plainer and set apart: `--surface-muted` with a
  **dashed** border ("holding area").
- Drop target: the hovered lane lifts its wash (~12%) and gains a
  `--tier-*-border` ring. Nothing else animates during a drag.
- Empty lane state is a quiet "Empty"; the pool's is "Everything is ranked".
- One HUD line: the remaining count as a large Bricolage figure (`tabular-nums`)
  + "left to rank"; on completion, "All N ranked ✓" (check in `--tier-c`).
- `N/A` and any custom `tier_config` label get the neutral fallback
  (`tierStyle` → NEUTRAL) and stay fully functional — no behaviour keys off the
  literal S/A/B/C/F. For `N/A` this is deliberate: it reads as "not rated,"
  never as a tier worse than F.

---

## 13. Rankable Cards

Cards should feel:

- Tactile
- Recognizable
- Easy to grab
- Easy to scan

A card may contain:

- Item image
- Item name
- Minimal supporting information if needed

Avoid stuffing cards with metadata.

Important states:

- Default
- Hover
- Focus
- Selected
- Dragging
- Disabled
- Submitted/read-only

Dragging should create clear spatial feedback.

### As built (Milestone 2)

A card is a tactile **tile**, not a form row:

- Monogram + name; when the card sits in a tier the monogram becomes that
  tier's badge (`tierStyle(tier).chip`) and a 3px left bar picks up the tier
  colour — so placements scan at a glance, **always** alongside the tier
  letter, never colour alone.
- States: `idle` (soft shadow, `active:scale-.98` press), `selected` (accent
  ring, lifts above siblings), `dragging` (dashed ghost placeholder at ~50%),
  `overlay` (the `<DragOverlay>` clone — shadow, slight rotate + scale).
- The **whole card** is the pointer drag surface (`MouseSensor` distance 8 /
  `TouchSensor` delay 200 + tolerance 8, so a tap selects and a swipe scrolls);
  `touch-action: pan-y` lets the page scroll through it.
- Long names wrap to two lines (`line-clamp-2`), never overflow.

---

## 14. Non-Drag Ranking

Mobile and keyboard users need an alternative.

A selected item can expose a compact tier picker.

The alternative should feel designed, not like an accessibility afterthought.

Do not create two completely different visual systems for drag and non-drag input.

### As built (Milestone 2)

**One** picker, **one** state path. Activating a card (tap / click / Enter /
Space) selects it; the `<MovePicker>` appears **inline, directly after that
card** on every viewport — the fastest layout for both thumb and mouse, since
the control lands where you just acted (evaluated in-browser at 320–1280px; a
fixed bottom bar added more travel for the common tap flow). It offers one
destination button per `tier_config` entry (tier-coloured, Bricolage) plus
"Unranked"; the current location is marked `aria-current`. Reordering within a
tier uses ▲ / ▼ controls that appear on the selected card. Escape or the ✕
closes it; focus returns to the moved card.

Drag, tap, keyboard, and reorder all dispatch the same `MOVE` action on the
single `useReducer` ranking state (`lib/game/ranking.ts`). An `aria-live`
region announces every move and the remaining count.

---

## 15. Submission CTA

The submit action should become obvious once ranking is complete.

Before completion:

- Explain what remains if necessary
- Avoid aggressive error states

At submission:

- Make commitment clear
- Avoid accidental double submission

After submission:

- Transition directly into the reveal experience

### As built (Milestone 3)

The submit control lives where the completion state used to sit, so the CTA
appears exactly when it becomes possible — no disabled-looking affordance
sitting idle beforehand.

- **Incomplete:** a disabled, full-width button ("Rank all items first") holds
  the CTA's place without inviting a click; the HUD's "N left to rank" already
  names what remains.
- **Ready:** a full-width accent button, Bricolage, "Submit ranking".
- **Confirm (lightweight, no modal):** one tap swaps the button in place for
  "Lock it in" + a secondary "Cancel", with one line of irreversible microcopy
  ("This locks your ranking for good — no changes after."). Rearranging the
  ranking, or pulling an item back to Unranked, drops back to the plain CTA.
- **Submitting:** a disabled button with a small spinner and "Submitting…"; the
  whole board goes `inert` (one attribute blocks every pointer/keyboard
  interaction, including drag) so nothing can be changed mid-request. No
  optimistic success.
- **Locked (success or "already submitted"):** the entire board unmounts and is
  replaced by a restrained panel — a check glyph, "Ranking locked in" (or
  "You're locked in" when recognised on a later visit), one muted line ("Your
  ranking is final — it can't be changed. Results open next."). Focus moves to
  the panel heading. No results, no confetti, no community data — that is
  Milestone 4.
- **Failure:** an inline `role="alert"` message in plain language, ranking
  untouched, the button returns to "Try again" (which re-opens the same confirm
  step — every submit is confirmed, including a retry).

No modal, no full results screen, no celebratory animation that delays the
player.

---

## 16. Results Reveal

Results should feel rewarding.

Prioritize:

1. User's ranking
2. Biggest agreement/disagreement insight
3. Community aggregate
4. Per-item details

Avoid opening with a dense table.

Good reveal moments may include:

- Community tier rows animating in
- Percentage counts settling
- Hottest take callout
- Friend disagreement reveal

Keep animations short.

---

## 17. Community Visualization

The aggregate tier list should remain understandable at a glance.

Per-item distributions may use:

- Compact bars
- Tier percentages
- Small distribution rows

Do not use complex charts when simpler tier visuals communicate better.

---

## 18. Friend Comparison

Friend comparison should feel conversational.

Highlight:

- Biggest disagreement
- Strong agreement
- Shared S-tier items
- Shared D-tier items

Side-by-side tier boards may work on desktop.

On mobile, use a stacked or focused comparison rather than forcing tiny columns.

---

## 19. Sharing

Share cards and share pages should create curiosity without spoilers.

Before recipient eligibility:

- Show game title/topic
- Show sender identity where appropriate
- Do not reveal actual placements

After eligibility:

- Reveal ranking cleanly
- Encourage comparison

Social preview imagery must remain spoiler-safe by default.

---

## 20. Landing Page

The landing page should teach the product visually.

Avoid:

- Long explanatory paragraphs
- Generic feature grids
- Empty marketing claims

Preferred storytelling:

1. Strong hook
2. Visual tier interaction
3. Social disagreement
4. Community/friend comparison
5. Daily recurrence
6. Clear play CTA

Scroll Craft may be used for intentional scroll-driven storytelling.

The landing page must still work without motion.

---

## 21. Motion

Use Motion when movement improves:

- Feedback
- Comprehension
- Spatial continuity
- Delight
- Storytelling

Good uses:

- Card placement
- Reordering
- Tier transitions
- Result reveal
- Friend comparison
- Landing page scenes

Avoid:

- Constant idle motion
- Animating every text block
- Long decorative transitions
- Delaying core interactions

Respect `prefers-reduced-motion`.

---

## 22. Mobile

Mobile is a primary experience.

Check at least:

- 320px
- 375px
- 390px
- 430px

Also check tablet and desktop.

Requirements:

- No accidental page-level horizontal scroll
- Comfortable touch targets
- Readable tier labels
- Cards remain usable at narrow widths
- Dragging does not fight page scrolling
- Alternative tier selection is available

Do not design desktop first and compress it later.

---

## 23. Desktop

Desktop can make more use of:

- Wider tier rows
- Side-by-side comparison
- Richer hover feedback
- Additional social context

Do not add desktop-only complexity without product value.

---

## 24. Accessibility

Design for:

- Keyboard navigation
- Visible focus
- Semantic elements
- Screen readers
- Reduced motion
- Sufficient contrast
- Non-drag ranking
- Touch interaction

Tier colors require visible text labels.

Do not communicate ranking state through color alone.

---

## 25. Loading States

Loading states should preserve layout where practical.

Prefer:

- Lightweight skeletons
- Stable dimensions
- Minimal layout shift

Do not overanimate skeletons.

For the daily game, avoid hiding the entire interface behind a large blocking loader if the shell can render immediately.

---

## 26. Empty States

Empty states should explain:

- What is missing
- Why
- What the user can do next

Examples:

- No friends yet
- No history yet
- No game scheduled
- No search results

Keep copy short.

---

## 27. Error States

Errors should:

- Use plain language
- Preserve user work where possible
- Offer a useful recovery action

Do not expose implementation details.

Ranking state should not disappear because an unrelated network request fails.

---

## 28. Admin Design

Admin should be visually consistent but more utilitarian.

Prioritize:

- Clarity
- Information density
- Fast editing
- Obvious status
- Safe destructive actions

Use shadcn primitives heavily where helpful.

Do not apply landing-page theatrics to admin.

---

## 29. Copy Style

Consumer-facing copy should be concise and confident.

Prefer:

> Rank today's list.

over:

> Please organize the following items according to your personal preferences.

Use personality when useful, especially around disagreement.

Do not let jokes reduce clarity.

---

## 30. Icons

Use one consistent icon set.

Do not mix icon styles casually.

Icons should supplement text, not replace necessary labels.

Avoid decorative icon clutter.

---

## 31. Images

Item imagery should:

- Use consistent crop behavior
- Load efficiently
- Have sensible fallbacks
- Not distort
- Include appropriate alt text

Do not let image inconsistency destroy tier-card alignment.

---

## 32. Design Tokens

Use CSS variables for established reusable values.

Do not create a token for every isolated value.

When a visual decision becomes repeated and intentional, promote it into the token system.

---

## 33. Component Reuse

Before creating a new visual primitive:

1. Check existing components
2. Check shadcn primitives
3. Determine whether a small composition is enough

Do not create near-duplicate button, modal, card, or input components.

Core game components can remain custom.

---

## 34. Visual Verification

For meaningful UI changes:

- Test in browser
- Inspect mobile
- Inspect desktop
- Check overflow
- Check focus
- Check reduced motion
- Check loading/error states

Use Vercel Web Design Guidelines after substantial frontend work.

Do not assume a compiling UI is visually correct.

---

## 35. Current Open Design Decisions

Decided in Milestone 1 (Step 2):

- [x] Display font — Bricolage Grotesque (sec 6)
- [x] Interface font — Hanken Grotesk (sec 6)
- [x] Base color palette — OKLCH tokens (sec 7)
- [x] Tier colors — provisional, AA-verified (sec 7); finalize after first board
- [x] Radius scale — sec 10
- [x] Light/dark strategy — light only for MVP; tokens structured for later dark (sec 8)

Still open:

- [ ] Product name (currently "Rankle")
- [ ] Logo/wordmark
- [ ] Motion timing
- [ ] Card style (settle alongside the first tier board / drag feedback)
- [ ] Landing-page visual language (deferred to Polish phase)
- [ ] Tier color final review (after the first tier board exists)

Until decided, avoid prematurely locking arbitrary choices into many files.

---

## 36. Design Principle

The interface should feel recognizable because of the game itself, not because of decorative effects.

The ideal reaction is:

> "That's the tier-list game."

not:

> "That's another modern web app."
