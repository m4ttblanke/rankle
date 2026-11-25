import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyGame } from "@/lib/game/schema";

/**
 * `/play` — today's game, moved here from `/`. Covers the route-level
 * behaviors that moved with it: `daily_game_viewed` fires here (once, only
 * for an identity that actually reaches the board), an already-submitted
 * identity is redirected server-side, and the `?share=` continuation is
 * still validated against today's game before being honored.
 */

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));
vi.mock("@/components/layout/app-header", () => ({ AppHeader: () => null }));
vi.mock("@/components/game/ranking-board", () => ({
  RankingBoard: ({ shareToken }: { shareToken: string | null }) =>
    `BOARD share=${shareToken ?? "none"}`,
}));

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
const getMyStreaks = vi.fn();
vi.mock("@/lib/game/get-streaks", () => ({ getMyStreaks }));
const getShare = vi.fn();
vi.mock("@/lib/game/get-share", () => ({ getShare }));
const logAnalyticsEvent = vi.fn();
vi.mock("@/lib/analytics/log", () => ({ logAnalyticsEvent }));

const { default: PlayPage } = await import("./page");

const TOKEN = "abcdef0123456789abcdef0123456789";
const GAME: DailyGame = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "fast-food-fries",
  title: "Fast Food Fries",
  prompt: null,
  releaseDate: "2026-11-25",
  tierConfig: ["S", "A", "B", "C", "F", "N/A"],
  items: [{ id: "22222222-2222-4222-8222-222222222222", label: "McDonald's", imageUrl: null, sortOrder: 0 }],
};

async function render(share?: string) {
  return renderToStaticMarkup(
    await PlayPage({ searchParams: Promise.resolve(share ? { share } : {}) }),
  );
}

async function redirectTarget(share?: string): Promise<string> {
  try {
    await render(share);
  } catch (err) {
    if (err instanceof RedirectError) return err.url;
    throw err;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
  getDailyGame.mockResolvedValue(GAME);
  getCurrentUser.mockResolvedValue(null);
  getGuestId.mockResolvedValue(null);
  hasSubmittedRanking.mockResolvedValue(false);
  getFriendPlayedStatus.mockResolvedValue([]);
  getMyStreaks.mockResolvedValue(null);
  getShare.mockResolvedValue(null);
  logAnalyticsEvent.mockResolvedValue(undefined);
});

describe("/play", () => {
  it("renders today's game board for an eligible player and logs daily_game_viewed exactly once", async () => {
    const html = await render();
    expect(html).toContain("Fast Food Fries");
    expect(html).toContain("BOARD share=none");
    expect(logAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(logAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "daily_game_viewed",
        tierlistId: GAME.id,
        properties: expect.objectContaining({ entry_source: "direct", item_count: 1 }),
      }),
    );
  });

  it("an already-submitted identity is redirected to /results and no view event is logged", async () => {
    hasSubmittedRanking.mockResolvedValue(true);
    expect(await redirectTarget()).toBe("/results");
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("a validated share continuation for today's game is carried into the board (entry_source=share)", async () => {
    getShare.mockResolvedValue({ tierlistSlug: GAME.slug, locked: true, ranking: null });
    const html = await render(TOKEN);
    // looked up with a null guest id — "which game is this?", never "is this visitor eligible?"
    expect(getShare).toHaveBeenCalledWith(TOKEN, null);
    expect(html).toContain(`BOARD share=${TOKEN}`);
    expect(logAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ properties: expect.objectContaining({ entry_source: "share" }) }),
    );
  });

  it("an already-submitted identity with a valid continuation goes back to /share/[token]", async () => {
    getShare.mockResolvedValue({ tierlistSlug: GAME.slug, locked: true, ranking: null });
    hasSubmittedRanking.mockResolvedValue(true);
    expect(await redirectTarget(TOKEN)).toBe(`/share/${TOKEN}`);
  });

  it("drops a token for another game, and a malformed token without even looking it up", async () => {
    getShare.mockResolvedValue({ tierlistSlug: "retro-snacks", locked: true, ranking: null });
    expect(await render(TOKEN)).toContain("BOARD share=none");

    getShare.mockClear();
    expect(await render("https://evil.example.com")).toContain("BOARD share=none");
    expect(getShare).not.toHaveBeenCalled();
  });

  it("no current game renders the empty state and logs nothing", async () => {
    getDailyGame.mockResolvedValue(null);
    const html = await render();
    expect(html).toMatch(/No game today/);
    expect(logAnalyticsEvent).not.toHaveBeenCalled();
  });
});
