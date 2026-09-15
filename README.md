# Rankle

> **Everyone has an opinion.**

Rankle is a daily social tier-list game where players rank a new set of items each day, lock in their choices, and then see how their opinions compare with the community and their friends.

Each day introduces a new topic, such as fast-food fries, movies, video games, snacks, or other debatable categories. Players organize the day's items into tiers, submit their ranking, and unlock community results and shared rankings.

**Rank → Submit → Compare → Share → Return tomorrow**

---

## Product Overview

Traditional tier-list tools focus on creating standalone rankings. Rankle turns tier lists into a daily social game.

Every day, Rankle publishes one official tier list containing a fixed set of items. Players place each item into a tier (**S, A, B, C, F, or N/A**) and submit their ranking.

Once submitted, the ranking is locked. Players can then compare their choices with the community, see where they agreed or disagreed with others, and share their ranking with friends.

Shared rankings are spoiler-protected. A recipient may be able to see that a friend completed the day's Rankle, but they must submit their own ranking before seeing the friend's placements.

The goal is to create a simple daily loop built around opinions, disagreement, and comparison rather than finding a single correct answer.

---

## Features

### Daily Game

- One official tier-list topic per day
- Fixed set of items to rank
- S, A, B, C, F, and N/A tiers (N/A for items the player hasn't tried)
- Drag-and-drop ranking interface, with a non-drag tap/keyboard alternative
- Rankings lock after submission
- Daily release schedule
- Support for guest and registered players

### Results

After submitting, players can unlock results such as:

- Community ranking
- Per-item tier distributions
- Community consensus
- Controversial items
- Personal disagreements with the community
- The player's own submitted ranking

Community results remain hidden until the player submits an official ranking.

### Social

Rankle is designed around sharing and comparing opinions.

Available now:

- Friends (search, requests, accept/decline, remove)
- Spoiler-protected share links
- Ranking history
- Post-submission friend ranking comparisons
- Compatibility scores

Planned:

- Cumulative multi-game head-to-head statistics
- Private groups
- Reactions

### Profiles

Registered users maintain a Rankle profile containing:

- Username
- Display name
- Avatar (initials placeholder today; image upload is planned)
- Ranking history
- Streak stats (current streak, longest streak, total games played)
- Friend relationships

### Admin

Administrators manage the daily Rankle content, including:

- Creating tier lists
- Adding and ordering items
- Scheduling release dates
- Editing drafts
- Publishing daily games
- Managing future topics

Additional administrative analytics and content-management tools are planned as the product develops.

> Some social features described above (private groups, reactions, cumulative head-to-head statistics) remain planned and are not yet available.

---

## Tech Stack

### Frontend

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **Motion for React**
- **dnd-kit**

### Backend

- **Next.js Server Actions / Route Handlers**
- **Supabase**
- **PostgreSQL**
- **Supabase Auth**
- **Supabase Storage**

### Validation & Testing

- **Zod**
- **Playwright**
- PostgreSQL / Supabase RLS behavioral tests

### Infrastructure

- **Vercel** (application hosting)
- **Supabase** (database, authentication, and storage)
- **Vercel Web Analytics** (anonymous traffic analytics)

---

## Architecture

Rankle uses a single Next.js application backed by Supabase.

```text
┌─────────────────────────────┐
│           Browser           │
│     Next.js / React UI      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│           Next.js           │
│                             │
│  Server Actions             │
│  Route Handlers             │
│  Server Components          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│          Supabase           │
│                             │
│  PostgreSQL                 │
│  Authentication             │
│  Storage                    │
│  Row Level Security         │
└─────────────────────────────┘
```

The PostgreSQL database is responsible for enforcing important product rules and authorization boundaries rather than relying exclusively on the client.

---

## User Roles

### Guest

Guests can play Rankle without creating an account.

Guest identity is designed to support the core daily game and sharing flow while remaining separate from registered account functionality.

### Authenticated User

Registered users can access account-specific functionality such as:

- Profile
- Ranking history
- Saved submissions
- Friends and friend comparisons

Authenticated users are still subject to database-level authorization and spoiler protection.

### Admin

Admins manage Rankle's daily content.

Administrative capabilities include creating, editing, scheduling, and managing tier lists and their items.

Admin authorization is enforced on the server and at the database level.

---

## Security & Game Integrity

Several rules are treated as core Rankle invariants:

- A player can submit only **one official ranking per daily game**.
- Official rankings cannot be edited after submission.
- Every item in a game must be ranked exactly once.
- Invalid or incomplete ranking payloads are rejected server-side.
- Community results are unavailable until the player submits.
- Unreleased daily games are not exposed to normal users.
- Shared rankings remain hidden from ineligible viewers.
- Administrative permissions are enforced server-side and through PostgreSQL Row Level Security.
- Sensitive credentials and service-role keys must never be exposed to the browser.

For the complete security model, see:

```text
docs/SECURITY.md
```

---

## Getting Started

### Prerequisites

Install the following before running Rankle locally:

- Node.js
- npm
- Git
- Supabase CLI
- Docker or another Supabase-compatible local container runtime if running the complete local Supabase stack

---

### Clone the Repository

```bash
git clone <repository-url>
cd rankle
```

---

### Install Dependencies

```bash
npm install
```

---

### Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Configure the required values in `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=                  # https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=      # the "sb_publishable_..." key
NEXT_PUBLIC_APP_URL=                       # optional; defaults to http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=                 # server-only; used only for guest-to-account claiming (app/auth/callback)
GUEST_COOKIE_SECRET=                       # server-only; signs the guest identity cookie, >= 16 chars
```

`.env.example` is the authoritative list, with notes on which values are public
vs server-only. `lib/env.ts` validates the public vars at startup.

**Never commit `.env.local`, API keys, database credentials, service-role keys, or other secrets to Git.**

Any service-role credential must remain server-only.

---

## Local Supabase

Start the local Supabase environment:

```bash
supabase start
```

Reset the local database and apply the migrations:

```bash
supabase db reset
```

Database migrations are stored in:

```text
supabase/migrations/
```

The migration files are the source of truth for Rankle's database schema.

Local development seed data is stored in:

```text
supabase/seed.sql
```

`seed.sql` is intended for **local development only** and should not be applied to the production database.

---

## Running Locally

Once dependencies and environment variables are configured:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Database

Rankle uses PostgreSQL through Supabase.

The database includes:

- `profiles`
- `tierlists`
- `tierlist_items`
- `submissions`
- `submission_items`
- `tierlist_item_stats`
- `shares`
- `claimed_guest_submissions`
- `friend_requests`
- `friendships`

Database responsibilities include:

- Daily game availability
- Submission integrity
- Ranking immutability
- Aggregate community statistics
- Spoiler protection
- Share authorization
- Admin authorization
- Row Level Security

Schema changes should be made through version-controlled migrations rather than manual production database changes.

---

## Testing

Changes should be tested before being merged or deployed.

### Commands

```bash
npm run lint        # ESLint (flat config)
npm run typecheck   # tsc --noEmit
npm test            # Vitest (unit + read-only integration)
npm run test:e2e    # Playwright end-to-end (auto-starts the dev server)
npm run build       # production build (also runs the type check)
```

First-time e2e setup: `npx playwright install chromium`.

### Unit / integration (Vitest)

`lib/**/*.test.ts` and `components/**/*.test.tsx`. Includes a narrowly scoped
**read-only** check against the remote Supabase project that verifies the RLS
trust boundaries (anon can list released games; the spoiler-gated tables and the
results RPC are closed). It creates/modifies nothing and skips when Supabase env
vars are absent.

### End-to-End (Playwright)

`e2e/` covers the daily-game shell, ranking and submission, results and spoiler
protection, sharing, authentication (real magic-link flow via local Mailpit),
friends, admin, the archive, and retention/streak features, plus responsive
layout at 320-430px and the 404 page.

### Database & RLS Testing

Database behavioral tests are located in:

```text
supabase/tests/
```

These tests verify important database guarantees such as:

- Row Level Security
- Admin authorization
- One submission per player per game
- Ranking immutability
- Ranking payload validation
- Transactional aggregate updates
- Results spoiler protection
- Share-link authorization

---

## Project Structure

As the application is built out, the repository follows approximately this structure:

```text
rankle/
├── app/                    # Next.js routes and application UI
├── components/             # Reusable React components
├── lib/                    # Shared application logic
├── public/                 # Static assets
├── supabase/
│   ├── migrations/         # Version-controlled database migrations
│   ├── tests/              # Database and RLS tests
│   ├── config.toml         # Local Supabase configuration
│   └── seed.sql            # Local-only development data
├── docs/
│   ├── MANUAL.md
│   ├── DESIGN.md
│   ├── SECURITY.md
│   ├── DEPLOY.md
│   ├── OPS.md
│   └── TODO.md
├── .env.example
├── CLAUDE.md
├── LICENSE.md
└── README.md
```

The exact structure may evolve as Rankle develops.

---

## Documentation

Detailed project documentation lives in `/docs`.

| Document | Purpose |
| --- | --- |
| `MANUAL.md` | Product behavior, flows, routes, and data model |
| `DESIGN.md` | Visual design system and UI conventions |
| `SECURITY.md` | Authentication, authorization, RLS, privacy, and security requirements |
| `DEPLOY.md` | Environment setup and deployment |
| `OPS.md` | Production monitoring, debugging, backups, and operations |
| `TODO.md` | Roadmap, deferred features, and outstanding work |

`CLAUDE.md` contains repository-level development instructions for AI-assisted development.

---

## Deployment

Rankle is live in production at https://rankle.io, deployed using:

- **Vercel** for the Next.js application
- **Supabase** for PostgreSQL, authentication, and storage

Production database changes should be applied through the migrations stored in `supabase/migrations/`.

Production secrets must be configured through the deployment environment and must never be committed to the repository.

For complete deployment instructions, see:

```text
docs/DEPLOY.md
```

---

## Contributing

When contributing to Rankle:

1. Create a focused branch for the change.
2. Follow the existing architecture and project conventions.
3. Keep changes scoped to the task.
4. Add or update tests when behavior changes.
5. Run relevant tests before committing.
6. Never commit secrets or local environment files.
7. Update documentation when product behavior, architecture, security, or deployment requirements change.

Security-sensitive changes should be reviewed against `docs/SECURITY.md`.

---

## Roadmap

Rankle is live and under active development.

Shipped:

- Daily ranking experience
- Community results
- Sharing
- User accounts and ranking history
- Friends and compatibility scores
- Streaks
- Admin content management
- Anonymous traffic analytics

Planned:

- Cumulative head-to-head statistics
- Private groups and reactions
- Contact-based friend discovery
- Product analytics (behavioral metrics)
- Production email via custom SMTP (replacing Supabase's built-in sender)

See `docs/TODO.md` for the current development roadmap.

---

## License

Rankle is licensed under the **MIT License**.

See [`LICENSE.md`](LICENSE.md) for the full license text.