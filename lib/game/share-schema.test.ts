import { describe, expect, it } from "vitest";
import { getShareResponseSchema, mapShare, shareTokenSchema } from "./share-schema";

describe("shareTokenSchema", () => {
  it("accepts a real generated token shape (32 lowercase hex chars)", () => {
    expect(
      shareTokenSchema.safeParse("5277f75208725a9321e69430ebf5bea1").success,
    ).toBe(true);
  });

  it.each([
    ["too short", "0123456789abcde"], // 15 chars
    ["uppercase", "ABCDEF0123456789ABCDEF0123456789"],
    ["non-hex characters", "not-a-real-token-at-all-zzzzzzzz"],
    ["empty", ""],
    ["path traversal attempt", "../../etc/passwd"],
    ["sql-ish payload", "'; drop table shares; --"],
  ])("rejects %s", (_name, value) => {
    expect(shareTokenSchema.safeParse(value).success).toBe(false);
  });
});

describe("getShareResponseSchema / mapShare", () => {
  it("accepts and maps a not-found/revoked response to null", () => {
    const parsed = getShareResponseSchema.safeParse({ found: false });
    expect(parsed.success).toBe(true);
    expect(mapShare({ found: false })).toBeNull();
  });

  it("accepts and maps a locked (pre-eligibility) response", () => {
    const raw = {
      found: true,
      sender: { username: "matt", display_name: "Matt" },
      tierlist: { slug: "fast-food-fries", title: "Fast Food Fries", prompt: null },
      locked: true,
      ranking: null,
    };
    expect(getShareResponseSchema.safeParse(raw).success).toBe(true);
    expect(mapShare(raw)).toEqual({
      senderUsername: "matt",
      senderDisplayName: "Matt",
      tierlistSlug: "fast-food-fries",
      tierlistTitle: "Fast Food Fries",
      tierlistPrompt: null,
      locked: true,
      ranking: null,
    });
  });

  it("accepts and maps a null sender (guest sender — no auth yet)", () => {
    const raw = {
      found: true,
      sender: null,
      tierlist: { slug: "fast-food-fries", title: "Fast Food Fries", prompt: null },
      locked: true,
      ranking: null,
    };
    const mapped = mapShare(raw);
    expect(mapped?.senderUsername).toBeNull();
    expect(mapped?.senderDisplayName).toBeNull();
  });

  it("accepts and maps an unlocked response with ranking", () => {
    const raw = {
      found: true,
      sender: { username: "matt", display_name: "Matt" },
      tierlist: { slug: "fast-food-fries", title: "Fast Food Fries", prompt: "Rank the fries." },
      locked: false,
      ranking: [
        {
          item_id: "10000000-0000-0000-0000-0000000000a1",
          label: "McDonald's",
          image_url: null,
          tier: "S",
          position: 0,
        },
      ],
    };
    expect(getShareResponseSchema.safeParse(raw).success).toBe(true);
    const mapped = mapShare(raw);
    expect(mapped?.locked).toBe(false);
    expect(mapped?.ranking).toEqual([
      {
        itemId: "10000000-0000-0000-0000-0000000000a1",
        label: "McDonald's",
        imageUrl: null,
        tier: "S",
        position: 0,
      },
    ]);
  });

  it("rejects a malformed payload (neither found:true nor found:false shape)", () => {
    expect(getShareResponseSchema.safeParse({ found: true }).success).toBe(false);
    expect(getShareResponseSchema.safeParse({ nonsense: 1 }).success).toBe(false);
    expect(() => mapShare({ nonsense: 1 })).toThrow();
  });
});
