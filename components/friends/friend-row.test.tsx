// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Friend } from "@/lib/game/friends";
import { FriendRow } from "./friend-row";

const removeFriend = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/remove-friend", () => ({ removeFriend }));

afterEach(() => {
  cleanup();
  removeFriend.mockReset();
});

const friend: Friend = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "matt",
  displayName: "Matt",
  avatarUrl: null,
};

describe("FriendRow", () => {
  it("removes the row only after the server action confirms success", async () => {
    removeFriend.mockResolvedValue({ ok: true, removed: true });
    const user = userEvent.setup();
    const { container } = render(<FriendRow friend={friend} played={null} />);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("keeps the row and shows a visible error when the server action fails", async () => {
    removeFriend.mockResolvedValue({ ok: false, reason: "network" });
    const user = userEvent.setup();
    render(<FriendRow friend={friend} played={null} />);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    // The friend must still be rendered -- a failed remove is not a removal.
    expect(await screen.findByText("Matt")).toBeTruthy();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn.t remove/i);
    expect(alert.className).not.toMatch(/sr-only/);
  });
});
