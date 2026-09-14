// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FocusHeading } from "./focus-heading";

afterEach(cleanup);

describe("FocusHeading", () => {
  it("moves focus to itself on mount", () => {
    render(<FocusHeading className="text-lg">Sign in</FocusHeading>);
    const heading = screen.getByRole("heading", { level: 1, name: "Sign in" });
    expect(document.activeElement).toBe(heading);
  });

  it("is a focusable but not tab-reachable landing target (tabIndex -1)", () => {
    render(<FocusHeading className="text-lg">Sign in</FocusHeading>);
    const heading = screen.getByRole("heading", { level: 1, name: "Sign in" });
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });
});
