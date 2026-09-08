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

- Display: TBD
- Interface/body: TBD

Do not introduce additional fonts without a clear reason.

---

## 7. Color

Use a small neutral foundation plus strong tier colors.

The UI should remain readable even when tier colors are visually prominent.

### Base Tokens

Record final values once selected:

```text
--background:
--foreground:
--surface:
--surface-muted:
--border:
--muted:
--accent:
--accent-foreground:
```

### Tier Tokens

```text
--tier-s:
--tier-a:
--tier-b:
--tier-c:
--tier-d:
```

Tier colors must remain distinguishable and accessible.

Do not rely on color alone to communicate tier identity; retain visible tier labels.

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

Record the final radius scale here once established.

Example categories:

- Small controls
- Cards/items
- Large surfaces

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

---

## 14. Non-Drag Ranking

Mobile and keyboard users need an alternative.

A selected item can expose a compact tier picker.

The alternative should feel designed, not like an accessibility afterthought.

Do not create two completely different visual systems for drag and non-drag input.

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

Complete these once the initial visual direction is approved:

- Product name
- Logo/wordmark
- Display font
- Interface font
- Base color palette
- Tier colors
- Radius scale
- Motion timing
- Card style
- Landing-page visual language
- Light/dark strategy

Until decided, avoid prematurely locking arbitrary choices into many files.

---

## 36. Design Principle

The interface should feel recognizable because of the game itself, not because of decorative effects.

The ideal reaction is:

> "That's the tier-list game."

not:

> "That's another modern web app."
