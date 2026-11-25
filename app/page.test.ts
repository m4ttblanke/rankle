import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyGame } from "@/lib/game/schema";

/**
 * The landing page (`/`) and its adaptive CTA. Every data dependency is
 * mocked so each state (no game / not submitted / submitted) is exercised
 * deterministically — the local seed can't produce "no game today."
 *
 * Spoiler boundary: the landing page must never call a result-bearing read
 * (`getResults`, `getShare`, `getFriendResults`) and must never log
 * `daily_game_viewed` — that event means "entered the board" and belongs
 * to `/play` only.
 */

vi.mock("@/components/layout/app-header", () => ({ AppHeader: () => null }));

const getDailyGame = vi.fn();
vi.mock("@/lib/game/get-daily-game", () => ({ getDailyGame }));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser }));
const getGuestId = vi.fn();
vi.mock("@/lib/game/guest", () => ({ getGuestId }));
const hasSubmittedRanking = vi.fn();
vi.mock("@/lib/game/submission-state", () => ({ hasSubmittedRanking }));
const getFriendPlayedStatus = vi.fn();
vi.mock("@/lib/game/friends", () => ({ getFriendPlayedStatus }));
const getArchive = vi.fn();
vi.mock("@/lib/game/archive", () => ({ getArchive }));

// Result-bearing reads + analytics: must never be touched by this route.
const getResults = vi.fn();
vi.mock("@/lib/game/get-results", () => ({ getResults }));
const getShare = vi.fn();
vi.mock("@/lib/game/get-share", () => ({ getShare, getTierlistIdBySlug: vi.fn() }));
const getFriendResults = vi.fn();
vi.mock("@/lib/game/get-friend-results", () => ({ getFriendResults }));
const logAnalyticsEvent = vi.fn();
vi.mock("@/lib/analytics/log", () => ({ logAnalyticsEvent }));

const { default: LandingPage, metadata } = await import("./page");

const GAME: DailyGame = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fast-food-fries",
  title: "Fast Food Fries",
  prompt: "Rank the fries.",
  releaseDate: "2026-11-25",
  tierConfig: ["S", "A", "B", "C", "F", "N/A"],
  items: ["McDonald's", "Five Guys", "In-N-Out"].map((label, i) => ({
    id: `22222222-2222-4222-8222-22222222222${i}`,
    label,
    imageUrl: null,
    sortOrder: i,
  })),
};

async function render(): Promise<string> {
  return renderToStaticMarkup(await LandingPage());
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  getDailyGame.mockResolvedValue(GAME);
  getCurrentUser.mockResolvedValue(null);
  getGuestId.mockResolvedValue(null);
  hasSubmittedRanking.mockResolvedValue(false);
  getFriendPlayedStatus.mockResolvedValue([]);
  getArchive.mockResolvedValue([
    { tierlistId: "a", slug: "retro-snacks", title: "Retro Snacks", releaseDate: "2026-11-24", isToday: false, played: null, submissionId: null },
    { tierlistId: GAME.id, slug: GAME.slug, title: GAME.title, releaseDate: GAME.releaseDate, isToday: true, played: null, submissionId: null },
  ]);
});

describe("landing page (/)", () => {
  it("renders the landing page with today's topic — not the ranking board", async () => {
    const html = await render();
    expect(html).toContain("Everyone has a ranking.");
    expect(html).toContain("Fast Food Fries");
    expect(html).toContain("3 things to rank");
    // no board: no draggable cards, no submit control, no Unranked pool list
    expect(html).not.toContain("data-card-id");
    expect(html).not.toMatch(/submit ranking/i);
    expect(html).not.toMatch(/unranked items/i);
  });

  it("a visitor who hasn't submitted gets Play CTAs pointing at /play, never /results", async () => {
    const html = await render();
    expect(html).toMatch(/Play Today’s Rankle/);
    expect(hrefs(html)).toContain("/play");
    expect(hrefs(html)).not.toContain("/results");
  });

  it("an identity that already submitted gets See Today's Results -> /results instead of /play", async () => {
    getGuestId.mockResolvedValue("33333333-3333-4333-8333-333333333333");
    hasSubmittedRanking.mockResolvedValue(true);
    const html = await render();
    expect(hasSubmittedRanking).toHaveBeenCalledWith(GAME.id, "33333333-3333-4333-8333-333333333333");
    expect(html).toMatch(/See Today’s Results/);
    expect(hrefs(html)).toContain("/results");
    expect(hrefs(html)).not.toContain("/play");
  });

  it("no current game: graceful message + archive link, no broken play/results CTA", async () => {
    getDailyGame.mockResolvedValue(null);
    const html = await render();
    expect(html).toMatch(/isn’t up yet/);
    expect(hrefs(html)).toContain("/archive");
    expect(hrefs(html)).not.toContain("/play");
    expect(hrefs(html)).not.toContain("/results");
    expect(hasSubmittedRanking).not.toHaveBeenCalled();
  });

  it("never calls a result-bearing read and never logs daily_game_viewed (or any product event)", async () => {
    getCurrentUser.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" });
    await render();
    hasSubmittedRanking.mockResolvedValue(true);
    await render();
    expect(getResults).not.toHaveBeenCalled();
    expect(getShare).not.toHaveBeenCalled();
    expect(getFriendResults).not.toHaveBeenCalled();
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("friend activity is a bare count only — no names, no ranking data", async () => {
    getCurrentUser.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555" });
    getFriendPlayedStatus.mockResolvedValue([
      { user: { id: "f1", username: "sam", displayName: "Sam Secret" }, played: true },
      { user: { id: "f2", username: "jo", displayName: "Jo Hidden" }, played: true },
      { user: { id: "f3", username: "al", displayName: "Al Unplayed" }, played: false },
    ]);
    const html = await render();
    expect(html).toContain("2 of your friends played today");
    expect(html).not.toMatch(/Sam Secret|Jo Hidden|Al Unplayed/);
  });

  it("a signed-out visitor never triggers the friends lookup and is offered sign-in", async () => {
    const html = await render();
    expect(getFriendPlayedStatus).not.toHaveBeenCalled();
    expect(hrefs(html)).toContain("/login");
  });

  it("every results/comparison visual is labelled as an example", async () => {
    const html = await render();
    const figures = html.match(/<figure[\s\S]*?<\/figure>/g) ?? [];
    expect(figures.length).toBeGreaterThanOrEqual(3);
    for (const fig of figures) expect(fig).toContain("Example");
  });

  it("past Rankles come from public archive metadata, with today's game marked as today", async () => {
    const html = await render();
    expect(html).toContain("Retro Snacks");
    expect(hrefs(html)).toContain("/archive");
  });

  it("metadata is static and topic-free (nothing spoiler-adjacent in social previews)", () => {
    const serialized = JSON.stringify(metadata);
    expect(serialized).toContain("Rankle");
    expect(serialized).not.toContain("Fast Food Fries");
  });
});
