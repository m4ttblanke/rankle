// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FriendRequestEntry } from "@/lib/game/friends-schema";
import { IncomingRequestRow } from "./incoming-request-row";
import { OutgoingRequestRow } from "./outgoing-request-row";

const acceptFriendRequest = vi.hoisted(() => vi.fn());
const declineFriendRequest = vi.hoisted(() => vi.fn());
const cancelFriendRequest = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/accept-friend-request", () => ({ acceptFriendRequest }));
vi.mock("@/app/actions/decline-friend-request", () => ({ declineFriendRequest }));
vi.mock("@/app/actions/cancel-friend-request", () => ({ cancelFriendRequest }));

afterEach(() => {
  cleanup();
  acceptFriendRequest.mockReset();
  declineFriendRequest.mockReset();
  cancelFriendRequest.mockReset();
});

const entry: FriendRequestEntry = {
  requestId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-09-01T00:00:00.000Z",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    username: "matt",
    displayName: "Matt",
    avatarUrl: null,
  },
};

describe("IncomingRequestRow", () => {
  it("shows a visible (not screen-reader-only) alert when accept fails", async () => {
    acceptFriendRequest.mockResolvedValue({ ok: false, reason: "network" });
    const user = userEvent.setup();
    render(<IncomingRequestRow entry={entry} />);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    const alert = await screen.findByRole("alert");
    expect(alert.className).not.toMatch(/sr-only/);
    expect(alert.textContent).toMatch(/something went wrong/i);
    // Row must still be present -- a failed accept never resolves as "done".
    expect(screen.getByText("Matt")).toBeTruthy();
  });
});

describe("OutgoingRequestRow", () => {
  it("shows a visible (not screen-reader-only) alert when cancel fails", async () => {
    cancelFriendRequest.mockResolvedValue({ ok: false, reason: "network" });
    const user = userEvent.setup();
    render(<OutgoingRequestRow entry={entry} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const alert = await screen.findByRole("alert");
    expect(alert.className).not.toMatch(/sr-only/);
    expect(alert.textContent).toMatch(/something went wrong/i);
    expect(screen.getByText("Matt")).toBeTruthy();
  });
});
