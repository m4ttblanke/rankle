// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DailyGame } from "@/lib/game/schema";
import { RankingBoard } from "./ranking-board";

// The submit Server Action reaches the network / Next request scope; the board
// tests only care that the CTA is wired to it and that success/duplicate both
// navigate to the results reveal (Milestone 4).
const submitRanking = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/submit-ranking", () => ({ submitRanking }));

const routerReplace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

afterEach(() => {
  cleanup();
  submitRanking.mockReset();
  routerReplace.mockReset();
});

function makeGame(
  tierConfig = ["S", "A", "B", "C", "F", "N/A"],
  labels = ["McDonald's", "Five Guys", "In-N-Out", "Wendy's"],
): DailyGame {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "g",
    title: "Fast Food Fries",
    prompt: null,
    releaseDate: "2026-09-08",
    tierConfig,
    items: labels.map((label, i) => ({
      id: `item-${i}`,
      label,
      imageUrl: null,
      sortOrder: i,
    })),
  };
}

// each card is a button whose accessible name starts with "<label> — "
const card = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${escapeRe(label)} — `) });

const lane = (name: RegExp) => screen.getByRole("list", { name });

const cardsIn = (name: RegExp) =>
  within(lane(name))
    .queryAllByRole("button", { name: / — / })
    .map((b) => b.getAttribute("aria-label")!.split(" — ")[0]);

const picker = () => screen.getByRole("group", { name: /^move /i });
const pickerBtn = (name: RegExp) => within(picker()).getByRole("button", { name });

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("<RankingBoard> initial state", () => {
  it("puts every item in Unranked; tiers empty; count shown; no picker", () => {
    render(<RankingBoard game={makeGame()} />);
    expect(cardsIn(/unranked items/i)).toEqual([
      "McDonald's",
      "Five Guys",
      "In-N-Out",
      "Wendy's",
    ]);
    for (const t of ["S", "A", "B", "C", "F", "N/A"]) {
      expect(cardsIn(new RegExp(`tier ${t}`, "i"))).toEqual([]);
    }
    expect(
      screen.getByRole("heading", { name: /unranked · 4/i }),
    ).toBeTruthy();
    expect(screen.getByText(/left to rank/i)).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("renders one lane per tierConfig entry (custom labels, no crash)", () => {
    render(<RankingBoard game={makeGame(["Top", "Mid", "Bot"], ["x", "y"])} />);
    expect(lane(/tier Top/i)).toBeTruthy();
    expect(lane(/tier Mid/i)).toBeTruthy();
    expect(lane(/tier Bot/i)).toBeTruthy();
    expect(cardsIn(/unranked items/i)).toEqual(["x", "y"]);
  });
});

describe("<RankingBoard> non-drag ranking (tap/click picker)", () => {
  it("pool -> tier: updates lanes, count, and the live region", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);

    await user.click(card("McDonald's"));
    await user.click(pickerBtn(/^tier B$/i));

    expect(cardsIn(/tier B/i)).toEqual(["McDonald's"]);
    expect(cardsIn(/unranked items/i)).toEqual([
      "Five Guys",
      "In-N-Out",
      "Wendy's",
    ]);
    expect(
      screen.getByRole("heading", { name: /unranked · 3/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("status", { name: /ranking updates/i }).textContent,
    ).toMatch(/McDonald's moved to tier B, position 1\. 3 left/i);
  });

  it("tier -> tier", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.click(card("Five Guys"));
    await user.click(pickerBtn(/^tier S$/i));
    await user.click(card("Five Guys"));
    await user.click(pickerBtn(/^tier C$/i));
    expect(cardsIn(/tier C/i)).toEqual(["Five Guys"]);
    expect(cardsIn(/tier S/i)).toEqual([]);
  });

  it("tier -> pool (return to unranked)", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.click(card("In-N-Out"));
    await user.click(pickerBtn(/^tier A$/i));
    await user.click(card("In-N-Out"));
    await user.click(pickerBtn(/^unranked$/i));
    expect(cardsIn(/unranked items/i)).toContain("In-N-Out");
    expect(
      screen.getByRole("heading", { name: /unranked · 4/i }),
    ).toBeTruthy();
  });

  it("closing the picker leaves the item where it was", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.click(card("Wendy's"));
    await user.click(pickerBtn(/close move menu/i));
    expect(screen.queryByRole("group")).toBeNull();
    expect(cardsIn(/unranked items/i)).toContain("Wendy's");
  });
});

describe("<RankingBoard> N/A tier (haven't tried, distinct from Unranked)", () => {
  it("tap/click: N/A is a normal destination and decrements remaining", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.click(card("McDonald's"));
    await user.click(pickerBtn(/^tier N\/A$/i));
    expect(cardsIn(/tier N\/A/i)).toEqual(["McDonald's"]);
    expect(
      screen.getByRole("heading", { name: /unranked · 3/i }),
    ).toBeTruthy();
  });

  it("moves from N/A to another tier, then back to Unranked", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.click(card("Five Guys"));
    await user.click(pickerBtn(/^tier N\/A$/i));
    await user.click(card("Five Guys"));
    await user.click(pickerBtn(/^tier B$/i));
    expect(cardsIn(/tier B/i)).toEqual(["Five Guys"]);
    expect(cardsIn(/tier N\/A/i)).toEqual([]);
    await user.click(card("Five Guys"));
    await user.click(pickerBtn(/^unranked$/i));
    expect(cardsIn(/unranked items/i)).toContain("Five Guys");
  });

  it("keyboard: N/A is reachable and selectable like any other tier", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.click(card("Wendy's"));
    pickerBtn(/^tier N\/A$/i).focus();
    await user.keyboard("{Enter}");
    expect(cardsIn(/tier N\/A/i)).toEqual(["Wendy's"]);
  });

  it("ranking every item into N/A still reaches the completion state", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    for (const label of ["McDonald's", "Five Guys", "In-N-Out", "Wendy's"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier N\/A$/i));
    }
    expect(screen.getByText(/all 4 ranked/i)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /unranked · 0/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^submit ranking$/i }),
    ).toBeTruthy();
  });

  it("submission payload preserves tier: \"N/A\" verbatim", async () => {
    submitRanking.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "N/A"], ["a", "b"])} />);
    await user.click(card("a"));
    await user.click(pickerBtn(/^tier S$/i));
    await user.click(card("b"));
    await user.click(pickerBtn(/^tier N\/A$/i));
    await user.click(screen.getByRole("button", { name: /^submit ranking$/i }));
    await user.click(screen.getByRole("button", { name: /^lock it in$/i }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/results"));
    expect(submitRanking).toHaveBeenCalledWith({
      tierlistId: "11111111-1111-4111-8111-111111111111",
      items: [
        { item_id: "item-0", tier: "S", position: 0 },
        { item_id: "item-1", tier: "N/A", position: 0 },
      ],
    });
  });
});

describe("<RankingBoard> reorder within a tier", () => {
  it("move up / move down reorders; disabled at the ends", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    for (const label of ["McDonald's", "Five Guys", "In-N-Out"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    expect(cardsIn(/tier S/i)).toEqual(["McDonald's", "Five Guys", "In-N-Out"]);

    // selecting keeps the reorder controls visible (no re-click needed)
    await user.click(card("Five Guys"));
    await user.click(screen.getByRole("button", { name: /move Five Guys up/i }));
    expect(cardsIn(/tier S/i)).toEqual(["Five Guys", "McDonald's", "In-N-Out"]);

    // now first -> "up" disabled, "down" still works
    expect(
      (screen.getByRole("button", { name: /move Five Guys up/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: /move Five Guys down/i }));
    expect(cardsIn(/tier S/i)).toEqual(["McDonald's", "Five Guys", "In-N-Out"]);
  });
});

describe("<RankingBoard> completion", () => {
  it("ranking every item shows the completion state and a submit control", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "A"], ["a", "b", "c"])} />);
    for (const label of ["a", "b", "c"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    expect(screen.getByText(/all 3 ranked/i)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /unranked · 0/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^submit ranking$/i }),
    ).toBeTruthy();
  });

  it("no submit control while any item remains unranked", () => {
    render(<RankingBoard game={makeGame()} />);
    expect(screen.queryByRole("button", { name: /^submit ranking$/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /rank all items first/i }),
    ).toHaveProperty("disabled", true);
  });
});

describe("<RankingBoard> submission and results handoff (Milestone 4)", () => {
  it("confirm -> lock it in -> replaces the URL with /results; board stays frozen", async () => {
    submitRanking.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "A"], ["a", "b", "c"])} />);
    for (const label of ["a", "b", "c"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    await user.click(screen.getByRole("button", { name: /^submit ranking$/i }));
    await user.click(screen.getByRole("button", { name: /^lock it in$/i }));

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/results"));
    // `replace` (not `push`): the pre-submit board must not become a back-button
    // destination once the ranking is immutable.
    expect(routerReplace).toHaveBeenCalledTimes(1);
    // Nothing can be edited while the navigation is in flight: the board stays
    // on its disabled "Submitting…" state rather than reopening the CTA.
    expect(
      screen.getByRole("button", { name: /submitting/i }),
    ).toHaveProperty("disabled", true);
    expect(submitRanking).toHaveBeenCalledWith({
      tierlistId: "11111111-1111-4111-8111-111111111111",
      items: [
        { item_id: "item-0", tier: "S", position: 0 },
        { item_id: "item-1", tier: "S", position: 1 },
        { item_id: "item-2", tier: "S", position: 2 },
      ],
    });
  });

  it("failed submission preserves the ranking and lets the player retry", async () => {
    submitRanking.mockResolvedValueOnce({ ok: false, reason: "network" });
    submitRanking.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "A"], ["a", "b", "c"])} />);
    for (const label of ["a", "b", "c"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    await user.click(screen.getByRole("button", { name: /^submit ranking$/i }));
    await user.click(screen.getByRole("button", { name: /^lock it in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn.t reach/i);
    // ranking still intact — every card is still placed in tier S
    expect(cardsIn(/tier S/i)).toEqual(["a", "b", "c"]);
    expect(routerReplace).not.toHaveBeenCalled();

    // "Try again" re-opens the same confirm step — every submit is confirmed
    await user.click(screen.getByRole("button", { name: /^try again$/i }));
    await user.click(screen.getByRole("button", { name: /^lock it in$/i }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/results"));
    expect(submitRanking).toHaveBeenCalledTimes(2);
  });

  it("duplicate/already-submitted is treated as a locked state, not an error", async () => {
    submitRanking.mockResolvedValue({ ok: false, reason: "already" });
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "A"], ["a", "b", "c"])} />);
    for (const label of ["a", "b", "c"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    await user.click(screen.getByRole("button", { name: /^submit ranking$/i }));
    await user.click(screen.getByRole("button", { name: /^lock it in$/i }));
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/results"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keyboard-only: Tab to Submit, Enter to confirm, Enter to lock in", async () => {
    submitRanking.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "A"], ["a", "b", "c"])} />);
    for (const label of ["a", "b", "c"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    screen.getByRole("button", { name: /^submit ranking$/i }).focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^lock it in$/i }),
    );
    await user.keyboard("{Enter}");
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/results"));
  });

  it("rapid double activation of Lock it in submits exactly once", async () => {
    let resolveSubmit!: (v: { ok: true }) => void;
    submitRanking.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame(["S", "A"], ["a", "b", "c"])} />);
    for (const label of ["a", "b", "c"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier S$/i));
    }
    await user.click(screen.getByRole("button", { name: /^submit ranking$/i }));
    const lockIn = screen.getByRole("button", { name: /^lock it in$/i });
    await user.click(lockIn);
    // the confirm button is replaced by a disabled "Submitting…" button, so a
    // second activation has nothing left to hit
    expect(screen.queryByRole("button", { name: /^lock it in$/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /submitting/i }),
    ).toHaveProperty("disabled", true);
    resolveSubmit({ ok: true });
    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/results"));
    expect(submitRanking).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledTimes(1);
  });
});

describe("<RankingBoard> keyboard-only path", () => {
  it("Tab to a card, Enter opens the picker, Enter on a tier moves it", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);

    await user.tab();
    expect(document.activeElement).toBe(card("McDonald's"));

    await user.keyboard("{Enter}");
    expect(screen.getByRole("group")).toBeTruthy();
    expect(document.activeElement).toBe(pickerBtn(/^tier S$/i));

    await user.keyboard("{Enter}");
    expect(cardsIn(/tier S/i)).toEqual(["McDonald's"]);
    expect(screen.queryByRole("group")).toBeNull();
    expect(document.activeElement).toBe(card("McDonald's"));
  });

  it("Escape closes the picker without moving", async () => {
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).toBeNull();
    expect(cardsIn(/unranked items/i)).toContain("McDonald's");
  });
});

describe("<RankingBoard> data boundary", () => {
  it("performs no network requests while ranking a full list", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("no network during ranking"));
    const user = userEvent.setup();
    render(<RankingBoard game={makeGame()} />);
    for (const label of ["McDonald's", "Five Guys", "In-N-Out", "Wendy's"]) {
      await user.click(card(label));
      await user.click(pickerBtn(/^tier A$/i));
    }
    expect(screen.getByText(/all 4 ranked/i)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
