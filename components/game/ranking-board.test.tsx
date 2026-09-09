// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DailyGame } from "@/lib/game/schema";
import { RankingBoard } from "./ranking-board";

afterEach(cleanup);

function makeGame(
  tierConfig = ["S", "A", "B", "C", "D"],
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
    for (const t of ["S", "A", "B", "C", "D"]) {
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
  it("ranking every item shows the completion state and NO submit control", async () => {
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
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
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
