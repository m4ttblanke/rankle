// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NoGameToday } from "./empty-state";

// Moved here from e2e/daily-game.spec.ts (Milestone 3): `/` now talks to the
// local Supabase stack, which is seeded with a live game, so the "no game
// published" state no longer occurs naturally in e2e. The component itself is
// unchanged and still worth covering directly.
describe("<NoGameToday>", () => {
  it("explains what's missing and invites a return visit", () => {
    render(<NoGameToday />);
    expect(
      screen.getByRole("heading", { name: /no game today/i }),
    ).toBeTruthy();
    expect(screen.getByText(/check back soon/i)).toBeTruthy();
  });
});
