import { beforeEach, expect, it, vi } from "vitest";

/**
 * The magic-link callback (Milestone 6) — fixed destinations only
 * (`/profile` on success, `/login?error=1` on failure), and the one call
 * site for guest-history claiming. Both inputs to the claim are asserted to
 * come from server-verified state (`auth.getUser()`, `getGuestId()`), never
 * from the request itself (there is no code path here that could).
 */

const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
const createClient = vi.fn(async () => ({
  auth: { exchangeCodeForSession, getUser },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const getGuestId = vi.fn();
vi.mock("@/lib/game/guest", () => ({ getGuestId }));

const claimGuestSubmissions = vi.fn();
vi.mock("@/lib/game/claim-guest-submissions", () => ({ claimGuestSubmissions }));

const { GET } = await import("./route");

const USER_ID = "55555555-5555-4555-8555-555555555555";
const GUEST_ID = "33333333-3333-4333-8333-333333333333";

function req(url: string) {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  exchangeCodeForSession.mockResolvedValue({ error: null });
  getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  getGuestId.mockResolvedValue(GUEST_ID);
  claimGuestSubmissions.mockResolvedValue(1);
});

it("on success, claims guest history and redirects to /profile", async () => {
  const res = await GET(req("http://localhost:3000/auth/callback?code=abc123"));
  expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
  expect(claimGuestSubmissions).toHaveBeenCalledWith(USER_ID, GUEST_ID);
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://localhost:3000/profile");
});

it("does not attempt to claim when there is no guest cookie", async () => {
  getGuestId.mockResolvedValue(null);
  await GET(req("http://localhost:3000/auth/callback?code=abc123"));
  expect(claimGuestSubmissions).not.toHaveBeenCalled();
});

it("redirects to /login?error=1 when the code is missing", async () => {
  const res = await GET(req("http://localhost:3000/auth/callback"));
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
  expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=1");
});

it("redirects to /login?error=1 when the exchange fails", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });
  const res = await GET(req("http://localhost:3000/auth/callback?code=bad"));
  expect(claimGuestSubmissions).not.toHaveBeenCalled();
  expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=1");
});

it("redirects to /login?error=1 if the exchange succeeds but no user comes back", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const res = await GET(req("http://localhost:3000/auth/callback?code=abc123"));
  expect(claimGuestSubmissions).not.toHaveBeenCalled();
  expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=1");
});

it("a thrown failure anywhere in the flow still redirects to /login?error=1, never leaking an error page", async () => {
  exchangeCodeForSession.mockRejectedValue(new Error("network blip"));
  const res = await GET(req("http://localhost:3000/auth/callback?code=abc123"));
  expect(res.headers.get("location")).toBe("http://localhost:3000/login?error=1");
});

it("never accepts a client-supplied redirect target — the query string cannot change the destination", async () => {
  const res = await GET(
    req("http://localhost:3000/auth/callback?code=abc123&next=https://evil.example.com"),
  );
  expect(res.headers.get("location")).toBe("http://localhost:3000/profile");
});
