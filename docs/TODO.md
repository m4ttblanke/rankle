# TODO.md

This file tracks meaningful project work.

Use four sections:

- Now
- Next
- Later
- Ideas

Do not add every tiny implementation task.

A TODO should represent a feature, meaningful technical task, decision, or operational improvement worth remembering across sessions.

Mark completed tracked work instead of silently deleting history immediately.

Periodically clean up old completed items.

---

# Now

## Foundation

- [ ] Choose final product name
- [ ] Finalize repository/package naming
- [ ] Initialize Next.js + TypeScript project
- [ ] Configure Tailwind CSS
- [ ] Configure shadcn/ui
- [ ] Configure Motion for React
- [ ] Configure dnd-kit
- [ ] Configure Supabase project
- [ ] Add `.env.example`
- [ ] Add initial Supabase migrations
- [ ] Establish base error handling
- [ ] Establish lint/typecheck/test commands

## Design

- [ ] Establish initial visual direction
- [ ] Choose display font
- [ ] Choose interface font
- [ ] Define base color tokens
- [ ] Define S/A/B/C/D tier colors
- [ ] Define basic radius/surface system
- [ ] Update `DESIGN.md` with approved decisions
- [ ] Build first responsive daily-game layout

## Core Game

- [ ] Create tier-list data model
- [ ] Create tier-list item data model
- [ ] Seed development games
- [ ] Resolve today's game from canonical timezone
- [ ] Build tier board
- [ ] Add drag-and-drop ranking
- [ ] Add non-drag ranking alternative
- [ ] Require all items before submission
- [ ] Implement official submission
- [ ] Enforce one registered-user submission per game
- [ ] Make submitted rankings immutable

## Results

- [ ] Add community result model
- [ ] Add per-item tier distributions
- [ ] Define aggregate ranking formula
- [ ] Define consensus formula
- [ ] Define controversy formula
- [ ] Define hottest-take formula
- [ ] Add unit tests for result calculations
- [ ] Build results reveal UI
- [ ] Enforce server-side spoiler gate

## Sharing

- [ ] Define share-record schema
- [ ] Add unguessable share tokens
- [ ] Build spoiler-safe share page
- [ ] Add Web Share API
- [ ] Add copy-link fallback
- [ ] Add spoiler-safe OpenGraph metadata

---

# Next

## Admin

- [ ] Add admin role model
- [ ] Document secure admin bootstrap
- [ ] Build `/admin`
- [ ] Create tier-list editor
- [ ] Add item reorder controls
- [ ] Add image upload
- [ ] Add preview
- [ ] Add scheduling
- [ ] Add release-date conflict protection
- [ ] Add admin calendar
- [ ] Add topic backlog
- [ ] Add duplicate-game action
- [ ] Add emergency disable/unpublish action

## Accounts

- [ ] Configure chosen Supabase Auth providers
- [ ] Build sign-in flow
- [ ] Add profile model
- [ ] Add unique usernames
- [ ] Add display names
- [ ] Add avatar support
- [ ] Add history page
- [ ] Add current streak
- [ ] Add longest streak
- [ ] Add total games played
- [ ] Add streak unit tests

## Friends

- [ ] Create friend-request model
- [ ] Create friendship model
- [ ] Prevent self/duplicate requests
- [ ] Build friend search
- [ ] Build request inbox
- [ ] Add accept/decline
- [ ] Add remove friend
- [ ] Add spoiler-safe friend activity count
- [ ] Add post-submission friend ranking comparison

## Product Analytics

- [ ] Choose analytics provider
- [ ] Track daily play starts
- [ ] Track successful submissions
- [ ] Track shares
- [ ] Track share visits
- [ ] Track share-to-play conversion
- [ ] Track account creation
- [ ] Avoid sending unnecessary PII

---

# Later

## Social

- [ ] Define compatibility score
- [ ] Add compatibility tests
- [ ] Add friend compatibility UI
- [ ] Add simple reactions
- [ ] Add internal share-to-friends flow
- [ ] Add optional groups
- [ ] Add group aggregate rankings

## Contacts

- [ ] Decide whether phone-number discovery is worth implementing
- [ ] Design privacy-preserving contact discovery
- [ ] Add phone normalization
- [ ] Add phone verification
- [ ] Add enumeration protection
- [ ] Add invite rate limiting

## SMS

- [ ] Evaluate SMS provider only if needed
- [ ] Estimate actual cost before launch
- [ ] Add provider abstraction
- [ ] Add abuse controls
- [ ] Add usage monitoring
- [ ] Ensure SMS is not required for normal sharing

## Archive

- [ ] Build archive browse experience
- [ ] Allow historical play
- [ ] Keep historical play separate from current streak
- [ ] Add friend completion indicators for archive games

## Moderation

- [ ] Add blocking if social features require it
- [ ] Add reporting if needed
- [ ] Add admin moderation tools if needed
- [ ] Add audit log if privileged actions justify it

## PWA / Retention

- [ ] Evaluate PWA after core loop is proven
- [ ] Evaluate push notifications
- [ ] Evaluate daily reminder opt-in

## Operations

- [ ] Configure production error monitoring
- [ ] Verify backup/restore process
- [ ] Add aggregate rebuild script
- [ ] Add automated critical-flow smoke tests
- [ ] Add usage/cost review procedure
- [ ] Document significant incident template

## Security (deferred beyond the initial schema/RLS migration)

The initial migration set enforces the trust boundaries (spoiler gate, admin
authorization, submission immutability, server-side payload validation,
transactional aggregates, share-link authorization) at the database level. The
items below are follow-up hardening that depends on real traffic, later
features, or infrastructure not yet in place.

- [ ] Rate limiting / abuse protection for guest-facing RPCs, especially
  `submit_ranking` and `create_share` (also `get_results` / `get_share` scans).
  Guests are unauthenticated (`anon`), so the current defenses are only the
  per-guest unique index and Supabase platform limits. Add per-IP / per-guest
  throttling (edge middleware, a lightweight counter table, or a platform WAF
  rule) before or shortly after public launch. Keep it simple first
  (SECURITY.md sec 19).
- [ ] Revisit guest identity hardening beyond the initial signed httpOnly
  `guest_id` cookie if abuse (ballot stuffing, fake community volume) becomes a
  real problem. Options to weigh only if needed: proof-of-work, attestation,
  soft account nudge before results, server-side correlation heuristics. Avoid
  invasive fingerprinting (SECURITY.md sec 26).
- [ ] Revisit public profile discovery/access when friend discovery and public
  profile pages are implemented. Direct `SELECT` on `public.profiles` is
  currently authenticated-only and anonymous share visitors get sender info
  only through controlled RPCs (`get_share`). When usernames become searchable,
  expose the minimum via a dedicated search RPC / view rather than widening the
  table policy; keep enumeration surface as narrow as possible (SECURITY.md
  sec 6, sec 24).
- [ ] Review whether additional production security controls are needed before
  public launch, based on observed traffic and abuse patterns: CAPTCHA on
  sign-up / guest submit, bot filtering, anomaly alerts, tighter CORS/CSP,
  automated RLS regression tests in CI, periodic advisor review. Decide with
  data, not speculation (CLAUDE.md sec 6, SECURITY.md sec 30).

---

# Ideas

These are not commitments.

- [ ] Daily category themes
- [ ] Friend-group leaderboards
- [ ] "Most controversial friend"
- [ ] "Closest rankings"
- [ ] Weekly recap
- [ ] Personal ranking statistics
- [ ] Shareable compatibility cards
- [ ] Community trend history
- [ ] Limited special-event games
- [ ] User-submitted topic suggestions
- [ ] Curated seasonal themes
- [ ] Optional custom tier labels for special games

---

# Decisions Needed

Track unresolved product choices here until decided.

- [ ] Final product name
- [ ] Final production domain
- [ ] Canonical application timezone confirmation
- [ ] Guest submission persistence approach
- [ ] Initial authentication providers
- [ ] Whether archived games can be played by guests
- [ ] Exact consensus formula
- [ ] Exact controversy formula
- [ ] Exact compatibility formula
- [ ] Whether dark mode launches in MVP
- [ ] Whether item images are required or optional per game

---

# Completed

Move meaningful completed items here temporarily when useful.

Remove stale completed items during periodic cleanup once they no longer provide useful project history.
