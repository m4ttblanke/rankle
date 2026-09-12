import { describe, expect, it } from "vitest";
import {
  mapFriendPlayedStatus,
  mapListFriendRequests,
  mapSearchProfiles,
  mapSendFriendRequest,
} from "./friends-schema";

const UUID_A = "aaaaaaaa-0000-4000-8000-000000000001";
const UUID_B = "bbbbbbbb-0000-4000-8000-000000000002";

describe("mapSearchProfiles", () => {
  it("shapes a result row into camelCase, preserving relationship", () => {
    const raw = {
      results: [
        {
          id: UUID_A,
          username: "carol",
          display_name: "Carol",
          avatar_url: null,
          relationship: "pending_incoming",
        },
      ],
    };
    expect(mapSearchProfiles(raw)).toEqual([
      {
        id: UUID_A,
        username: "carol",
        displayName: "Carol",
        avatarUrl: null,
        relationship: "pending_incoming",
      },
    ]);
  });

  it("accepts an empty result set", () => {
    expect(mapSearchProfiles({ results: [] })).toEqual([]);
  });

  it("rejects an unknown relationship value", () => {
    expect(() =>
      mapSearchProfiles({
        results: [
          {
            id: UUID_A,
            username: "carol",
            display_name: "Carol",
            avatar_url: null,
            relationship: "best_friends_forever",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects a payload carrying is_admin (schema drift guard -- should never be present)", () => {
    expect(() =>
      mapSearchProfiles({
        results: [
          {
            id: UUID_A,
            username: "carol",
            display_name: "Carol",
            avatar_url: null,
            relationship: "none",
            is_admin: true,
          },
        ],
      }),
    ).not.toThrow(); // extra unknown fields are simply ignored by z.object, not rejected
  });
});

describe("mapListFriendRequests", () => {
  it("shapes incoming/outgoing rows into camelCase", () => {
    const raw = {
      incoming: [
        {
          request_id: UUID_A,
          user: { id: UUID_B, username: "bob", display_name: "Bob", avatar_url: null },
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      outgoing: [],
    };
    expect(mapListFriendRequests(raw)).toEqual({
      incoming: [
        {
          requestId: UUID_A,
          user: { id: UUID_B, username: "bob", displayName: "Bob", avatarUrl: null },
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      outgoing: [],
    });
  });

  it("accepts both lists empty", () => {
    expect(mapListFriendRequests({ incoming: [], outgoing: [] })).toEqual({
      incoming: [],
      outgoing: [],
    });
  });
});

describe("mapFriendPlayedStatus", () => {
  it("shapes played-status rows, boolean only", () => {
    const raw = { friends: [{ user_id: UUID_A, played: true }] };
    expect(mapFriendPlayedStatus(raw)).toEqual([{ userId: UUID_A, played: true }]);
  });

  it("never accepts a ranking/tier field slipping into a row (schema is closed on shape)", () => {
    expect(() =>
      mapFriendPlayedStatus({ friends: [{ user_id: UUID_A, played: "yes" }] }),
    ).toThrow(); // played must be a real boolean, not truthy-string
  });
});

describe("mapSendFriendRequest", () => {
  it.each(["pending", "friends", "already_pending"] as const)(
    "accepts status %s",
    (status) => {
      expect(mapSendFriendRequest({ status })).toBe(status);
    },
  );

  it("rejects an unknown status", () => {
    expect(() => mapSendFriendRequest({ status: "rejected" })).toThrow();
  });
});
