# CLAUDE.md

This file defines how Claude Code should work in this repository.

The product is a daily social tier-list game. Each day, players rank a fixed set of items into tiers, submit their ranking, compare with the community and friends, share the result, and return for the next daily game.

Core loop:

**Rank → Submit → Compare → Share → Return tomorrow**

Primary engineering principle:

**Keep the architecture boring and the product memorable.**

---

## 1. Source of Truth

Follow guidance in this order:

1. Explicit user instructions
2. Existing product behavior and repository requirements
3. Relevant files in `/docs`
4. This `CLAUDE.md`
5. Existing code conventions
6. Skills, agents, MCPs, libraries, and external best practices

Project documentation outranks generic tooling recommendations.

Do not silently change product behavior, architecture, or design because an external skill or MCP suggests another approach.

---

## 2. Read Documentation Only When Relevant

Do not read every documentation file for every task.

Use this routing:

- Product behavior, routes, data model, user flows → `docs/MANUAL.md`
- Visual design, UI patterns, typography, spacing, motion → `docs/DESIGN.md`
- Auth, RLS, private data, permissions, spoiler protection → `docs/SECURITY.md`
- Environment variables, Supabase/Vercel setup, production deployment → `docs/DEPLOY.md`
- Monitoring, logging, incidents, backups, debugging production → `docs/OPS.md`
- Roadmap and unfinished work → `docs/TODO.md`

For a substantial task, read the relevant file before implementing.

For a trivial task, do not load unrelated documentation.

---

## 3. Intended Stack

Use the existing repository stack unless explicitly changed:

- Next.js
- React
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui
- Motion for React
- dnd-kit
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Zod
- Playwright
- Vercel

Prefer the repository's existing package manager and conventions.

Do not introduce another framework, database, backend, state library, component library, or infrastructure service without a concrete need.

---

## 4. Simplicity

Prefer solutions in roughly this order:

1. Reuse existing project code and patterns
2. Use native browser/platform functionality
3. Use an existing dependency
4. Write a small local implementation
5. Add a new dependency or abstraction only when justified

Avoid:

- Speculative abstractions
- Single-implementation interfaces
- Factories without a real need
- Infrastructure "for later"
- Dependencies for trivial functionality
- Many files for tiny features
- Premature optimization
- Microservices
- Separate backend services without a real requirement

Use Ponytail principles as an engineering simplicity constraint.

Do not simplify away:

- Security
- Authorization
- Trust-boundary validation
- Database integrity
- Accessibility
- Important tests
- Deliberate product polish

Default to Ponytail `lite` thinking for normal work. Use `full` mainly for backend, infrastructure, refactors, utilities, and dependency reduction. Use `ultra` only when explicitly requested.

---

## 5. Critical Product Invariants

These rules must not be violated.

### Submission

An official daily ranking is immutable after submission unless product requirements explicitly change.

Enforce one official submission per registered user per game at the database level.

Draft rankings do not count toward community statistics.

### Spoilers

A player must not see community rankings or friend rankings for a daily game before submitting their own official ranking.

Spoiler protection must be enforced server-side.

Do not leak result data through:

- API responses
- React Server Component payloads
- Hidden DOM
- Prefetched client data
- Metadata
- OpenGraph data
- Cached responses

### Admin

Admin authorization must be enforced server-side.

Never trust client state, hidden navigation, or client-provided role values.

There must not be a public "make me admin" path.

### Private Data

Never expose private fields such as phone numbers through public profile queries.

Never expose Supabase service-role credentials to browser code.

---

## 6. Cost Awareness

This is a passion project.

Keep infrastructure near free-tier cost while usage is small.

Before adding a paid or usage-based service, check whether the current stack can solve the problem.

Pay particular attention to:

- SMS
- Email volume
- AI APIs
- Object storage
- Analytics
- Image processing
- Logging
- Database compute

Do not optimize for hypothetical millions of users.

Do not compromise security or integrity merely to save money.

---

## 7. Frontend Philosophy

The consumer application should feel like a polished daily game, not:

- A SaaS dashboard
- A generic startup template
- A shadcn demo
- A component-library showcase
- Generic AI-generated UI

Prioritize:

- Strong hierarchy
- Distinctive identity
- Fast interactions
- Short copy
- Mobile usability
- Immediate feedback
- Meaningful motion
- Minimal friction

The tier board, result reveal, friend comparison, and sharing experience deserve the most product polish.

Read `docs/DESIGN.md` before substantial visual work.

---

## 8. Accessibility

Accessibility is required.

Important interactions must support:

- Semantic HTML
- Keyboard navigation
- Visible focus
- Accessible labels
- Adequate contrast
- Reduced motion
- Touch-friendly controls
- A non-drag alternative for ranking

Do not use clickable `<div>` elements when an appropriate native interactive element exists.

---

## 9. Server vs Client

Default to Server Components when client-side behavior is unnecessary.

Use Client Components for genuine interactivity such as:

- Drag-and-drop
- Animation
- Local ranking state
- Browser APIs

Do not mark large trees `"use client"` merely for convenience.

Keep privileged operations server-side.

---

## 10. Database Changes

All schema changes must use migrations.

Use database constraints for important invariants where practical.

Before changing schema, permissions, auth, or private-data behavior, read:

`docs/SECURITY.md`

Do not rely on undocumented manual production database edits.

---

## 11. Validation

Treat all client input as untrusted.

Validate meaningful trust boundaries using Zod or the existing validation layer.

Examples:

- Form submissions
- IDs and slugs
- Admin mutations
- Profile updates
- Share tokens
- Upload metadata
- Relationship actions

Do not add redundant validation deep inside trusted internal functions.

---

## 12. Skill and MCP Usage

Do not invoke every available skill because it exists.

Use the smallest useful set for the current task.

### Anthropic Frontend Design

Use for creating or substantially redesigning major consumer-facing UI.

Its role is creative direction and avoiding generic generated design.

### Interface Design

Use primarily for application interfaces such as:

- Daily game
- Results
- Profiles
- Friends
- Settings
- Archive
- Admin

### Scroll Craft

Use deliberately for the marketing/landing page.

Do not use it for ordinary product screens.

### Vercel Web Design Guidelines

Use as an audit step after meaningful frontend work.

Fix legitimate accessibility, responsiveness, interaction, and usability issues.

### UI/UX Pro Max

Use selectively for UX research, layout exploration, typography, responsive patterns, and accessibility input.

It is reference material, not project law.

### shadcn MCP

Use for conventional primitives such as:

- Buttons
- Forms
- Dialogs
- Sheets
- Dropdowns
- Tabs
- Tooltips
- Tables
- Admin controls

Do not let shadcn define the product's visual identity.

### 21st.dev / Magic MCP

Use selectively for higher-level inspiration or components.

Inspect source and dependencies before adopting community components.

Do not assemble the app from unrelated third-party pieces.

### ECC

Use selectively for:

- Planning
- TDD
- Testing
- Code review
- Security review
- Database review
- Debugging
- Refactoring
- Deployment checks

Do not orchestrate many agents for straightforward work.

---

## 13. Design Guidance Priority

When design guidance conflicts:

1. Explicit user direction
2. `docs/DESIGN.md`
3. Accessibility and functional correctness
4. Established project patterns
5. Anthropic Frontend Design
6. Interface Design
7. Vercel Web Design Guidelines
8. UI/UX Pro Max
9. 21st.dev/community suggestions

Skills assist the design system; they do not replace it.

---

## 14. Scope Discipline

When implementing a feature:

- Make the requested change
- Include necessary supporting work
- Avoid unrelated rewrites

If you discover an unrelated issue:

- Fix it immediately only if it blocks the task or is a serious security/correctness problem
- Otherwise add it to `docs/TODO.md` if it is worth tracking

Do not turn every task into a refactor.

---

## 15. Before Substantial Work

For nontrivial tasks:

1. Inspect the relevant existing code
2. Read the relevant documentation file(s)
3. Identify security/database implications
4. Identify the smallest coherent solution
5. Make a concise plan
6. Implement

Do not create many files before understanding the existing repository.

---

## 16. Before Finishing

For meaningful changes:

1. Review the diff
2. Remove accidental complexity
3. Run relevant tests
4. Run lint
5. Run TypeScript checks
6. Run a production build when appropriate
7. Verify important UI in a browser when relevant
8. Update relevant docs
9. Update `docs/TODO.md` if tracked work was completed

Do not claim completion while knowingly leaving errors caused by the change.

---

## 17. Git Safety

Keep diffs focused.

Do not modify unrelated files without reason.

Never perform destructive Git operations unless explicitly requested.

Do not:

- Reset user work
- Rewrite history
- Force push
- Delete branches
- Discard uncommitted changes

without explicit permission.

Never commit secrets.

---

## 18. Environment Variables

Maintain `.env.example`.

When adding or removing environment variables:

- Update `.env.example`
- Update `docs/DEPLOY.md` when relevant
- Clearly distinguish public and server-only values

Never expose secrets through `NEXT_PUBLIC_*`.

---

## 19. Do Not Fake Integrations

If credentials or external infrastructure are unavailable:

1. Implement the correct integration boundary if useful
2. Add required variables to `.env.example`
3. Document setup in `docs/DEPLOY.md`
4. Add unfinished setup to `docs/TODO.md`

Never hardcode fake production credentials or claim an integration was verified when it was not.

---

## 20. Final Principle

Users should remember:

- Ranking today's topic
- Making an outrageous placement
- Discovering community disagreement
- Comparing with friends
- Sharing the result
- Coming back tomorrow

They should not experience the complexity underneath.

When two technically sound solutions exist, prefer the one that is:

- Simpler
- Easier to debug
- Easier to operate
- Cheaper
- Harder to misuse
- Easier to remove later

**Keep the architecture boring and the product memorable.**
