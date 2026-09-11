import { describe, expect, it } from "vitest";
import { submitRankingInputSchema } from "./submission";

const uuid = "11111111-1111-4111-8111-111111111111";
const uuid2 = "22222222-2222-4222-8222-222222222222";

function payload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tierlistId: uuid,
    items: [{ item_id: uuid2, tier: "S", position: 0 }],
    ...overrides,
  };
}

describe("submitRankingInputSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(submitRankingInputSchema.safeParse(payload()).success).toBe(true);
  });

  it("rejects a non-uuid tierlistId", () => {
    expect(
      submitRankingInputSchema.safeParse(payload({ tierlistId: "not-a-uuid" }))
        .success,
    ).toBe(false);
  });

  it("rejects an empty items array (server never accepts an incomplete draft)", () => {
    expect(submitRankingInputSchema.safeParse(payload({ items: [] })).success).toBe(
      false,
    );
  });

  it("rejects a non-array items value", () => {
    expect(
      submitRankingInputSchema.safeParse(payload({ items: {} })).success,
    ).toBe(false);
  });

  it("rejects a negative position", () => {
    expect(
      submitRankingInputSchema.safeParse(
        payload({ items: [{ item_id: uuid2, tier: "S", position: -1 }] }),
      ).success,
    ).toBe(false);
  });

  it("rejects a non-integer position", () => {
    expect(
      submitRankingInputSchema.safeParse(
        payload({ items: [{ item_id: uuid2, tier: "S", position: 1.5 }] }),
      ).success,
    ).toBe(false);
  });

  it("rejects a missing tier", () => {
    expect(
      submitRankingInputSchema.safeParse(
        payload({ items: [{ item_id: uuid2, position: 0 }] }),
      ).success,
    ).toBe(false);
  });

  it("rejects an unknown item id", () => {
    expect(
      submitRankingInputSchema.safeParse(
        payload({ items: [{ item_id: "nope", tier: "S", position: 0 }] }),
      ).success,
    ).toBe(false);
  });

  // Trust boundary: a guest/user id smuggled onto the payload must never
  // become trusted data. `.strict()` rejects unknown top-level keys outright.
  it("rejects an unexpected top-level field (e.g. a spoofed guestId)", () => {
    const result = submitRankingInputSchema.safeParse(
      payload({ guestId: "11111111-1111-1111-1111-111111111111" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unexpected field on an item row", () => {
    expect(
      submitRankingInputSchema.safeParse(
        payload({
          items: [{ item_id: uuid2, tier: "S", position: 0, user_id: uuid }],
        }),
      ).success,
    ).toBe(false);
  });

  it("does not validate semantic rules — that stays the database's job", () => {
    // duplicate item ids, unknown tiers, incomplete rankings, and games that
    // are closed are all shape-valid here; submit_ranking is the authority.
    const result = submitRankingInputSchema.safeParse(
      payload({
        items: [
          { item_id: uuid2, tier: "made-up", position: 0 },
          { item_id: uuid2, tier: "made-up", position: 0 },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });
});
