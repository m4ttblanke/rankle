// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShareButton } from "./share-button";

/**
 * Share Button Reliability fix (docs/TODO.md). CREATE (the server call) and
 * SHARE/COPY (browser-level convenience APIs) are distinct concerns — a
 * failure in the latter two must never be reported as the former.
 *
 * Navigator mocks are applied AFTER `userEvent.setup()`/`render()`, right
 * before the click: `userEvent.setup()` installs its own clipboard stub
 * internally, which would otherwise silently override a mock configured
 * beforehand.
 */

const createShare = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/create-share", () => ({ createShare }));

const TOKEN = "abcdef0123456789abcdef0123456789";

function setNavigatorShare(impl: ((data: unknown) => Promise<void>) | undefined) {
  Object.defineProperty(window.navigator, "share", {
    value: impl,
    configurable: true,
  });
}

function setClipboard(impl: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(window.navigator, "clipboard", {
    value: impl,
    configurable: true,
  });
}

afterEach(() => {
  cleanup();
  createShare.mockReset();
  setNavigatorShare(undefined);
});

describe("ShareButton — backend creation failure", () => {
  it("shows the true creation-failure message and never fabricates a URL", async () => {
    createShare.mockResolvedValue({ ok: false, reason: "network" });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    await user.click(screen.getByRole("button", { name: /share your ranking/i }));

    await waitFor(() =>
      expect(screen.getByText(/couldn.t create a share link/i)).toBeTruthy(),
    );
    expect(screen.queryByLabelText(/share link/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^copy$/i })).toBeNull();
  });
});

describe("ShareButton — clipboard fallback (no navigator.share)", () => {
  it("clipboard success shows Link copied", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    await user.click(screen.getByRole("button", { name: /share your ranking/i }));

    await waitFor(() => expect(screen.getByText(/^link copied$/i)).toBeTruthy());
  });

  it("clipboard failure does NOT show the creation-failure message, and exposes the real URL for manual use", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });

    await user.click(screen.getByRole("button", { name: /share your ranking/i }));

    await waitFor(() =>
      expect(screen.getByText(/share link created, but we couldn.t copy/i)).toBeTruthy(),
    );
    expect(screen.queryByText(/couldn.t create a share link/i)).toBeNull();
    const field = screen.getByLabelText(/share link/i) as HTMLInputElement;
    expect(field.value).toMatch(new RegExp(`/share/${TOKEN}$`));
  });

  it("clipboard entirely unavailable (undefined) behaves the same as a failure, not a crash", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setClipboard(undefined);

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));

    await waitFor(() =>
      expect(screen.getByText(/share link created, but we couldn.t copy/i)).toBeTruthy(),
    );
    const field = screen.getByLabelText(/share link/i) as HTMLInputElement;
    expect(field.value).toMatch(new RegExp(`/share/${TOKEN}$`));
  });

  it("the manual Copy button retries the clipboard directly, without re-calling createShare", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(undefined);
    setClipboard({ writeText });

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^copy$/i })).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    await waitFor(() => expect(screen.getByText(/^link copied$/i)).toBeTruthy());
    expect(createShare).toHaveBeenCalledTimes(1);
  });
});

describe("ShareButton — native Web Share", () => {
  it("success shows no error", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setNavigatorShare(vi.fn().mockResolvedValue(undefined));

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /share your ranking$/i }),
      ).toHaveProperty("disabled", false),
    );
    expect(screen.queryByText(/couldn.t create a share link/i)).toBeNull();
    expect(screen.queryByText(/share link created, but/i)).toBeNull();
  });

  it("user cancellation (AbortError) is not shown as any kind of error", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    const err = Object.assign(new Error("cancelled"), { name: "AbortError" });
    setNavigatorShare(vi.fn().mockRejectedValue(err));

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /share your ranking$/i }),
      ).toHaveProperty("disabled", false),
    );
    expect(screen.queryByText(/couldn.t create a share link/i)).toBeNull();
    expect(screen.queryByText(/share link created, but/i)).toBeNull();
  });

  it("a real (non-cancellation) native-share failure falls back to clipboard once, deterministically", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setNavigatorShare(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));

    await waitFor(() => expect(screen.getByText(/^link copied$/i)).toBeTruthy());
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("native-share failure + clipboard failure lands on the manual fallback, never the creation-failure message", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setNavigatorShare(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));

    await waitFor(() =>
      expect(screen.getByText(/share link created, but we couldn.t copy/i)).toBeTruthy(),
    );
    expect(screen.queryByText(/couldn.t create a share link/i)).toBeNull();
  });
});

describe("ShareButton — idempotency", () => {
  it("an already-resolved URL is reused; retrying after a copy failure never re-calls createShare", async () => {
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));
    await waitFor(() => expect(screen.getByLabelText(/share link/i)).toBeTruthy());

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));
    await waitFor(() => expect(screen.getByLabelText(/share link/i)).toBeTruthy());

    expect(createShare).toHaveBeenCalledTimes(1);
  });

  it("an idempotent (pre-existing) share token from the backend behaves identically to a fresh one", async () => {
    // create_share is idempotent server-side; the client has no separate
    // code path for this — the same success shape is returned either way.
    createShare.mockResolvedValue({ ok: true, token: TOKEN });
    const user = userEvent.setup();
    render(<ShareButton submissionId="s1" gameTitle="Fast Food Fries" />);
    setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

    await user.click(screen.getByRole("button", { name: /share your ranking$/i }));

    await waitFor(() => expect(screen.getByText(/^link copied$/i)).toBeTruthy());
  });
});
