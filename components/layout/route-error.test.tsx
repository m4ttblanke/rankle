// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteError } from "./route-error";

afterEach(cleanup);

describe("RouteError", () => {
  it("shows the given message and calls reset on click, with no implementation detail leaked", () => {
    const reset = vi.fn();
    render(<RouteError message="Your results couldn’t load. This is usually temporary." reset={reset} />);

    expect(screen.getByText(/your results couldn.t load/i)).toBeTruthy();
    expect(screen.queryByText(/stack|sql|postgres|supabase/i)).toBeNull();
  });

  it("calls reset when 'Try again' is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<RouteError message="Something broke." reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
