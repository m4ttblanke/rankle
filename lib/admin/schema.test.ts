import { describe, expect, it } from "vitest";
import {
  createTierlistSchema,
  duplicateTierlistSchema,
  scheduleTierlistSchema,
  setTierlistItemsSchema,
  updateTierlistSchema,
} from "./schema";

describe("createTierlistSchema", () => {
  it("accepts a minimal valid draft", () => {
    expect(createTierlistSchema.safeParse({ slug: "fast-food-fries", title: "Fast Food Fries" }).success).toBe(
      true,
    );
  });

  it("lowercases the slug", () => {
    const parsed = createTierlistSchema.parse({ slug: "Fast-Food-Fries", title: "X" });
    expect(parsed.slug).toBe("fast-food-fries");
  });

  it.each(["not valid", "trailing-", "-leading", "double--hyphen"])(
    "rejects an invalid slug %s",
    (slug) => {
      expect(createTierlistSchema.safeParse({ slug, title: "X" }).success).toBe(false);
    },
  );

  it("rejects an empty title", () => {
    expect(createTierlistSchema.safeParse({ slug: "x", title: "" }).success).toBe(false);
  });

  it("rejects status/release_date/tier_config as extra fields (.strictObject)", () => {
    expect(
      createTierlistSchema.safeParse({ slug: "x", title: "X", status: "live" }).success,
    ).toBe(false);
    expect(
      createTierlistSchema.safeParse({ slug: "x", title: "X", tierConfig: ["S", "F"] }).success,
    ).toBe(false);
  });
});

describe("updateTierlistSchema", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("requires a valid uuid id", () => {
    expect(updateTierlistSchema.safeParse({ id: "not-a-uuid", slug: "x", title: "X" }).success).toBe(false);
    expect(updateTierlistSchema.safeParse({ id: ID, slug: "x", title: "X" }).success).toBe(true);
  });
});

describe("scheduleTierlistSchema", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("accepts YYYY-MM-DD", () => {
    expect(scheduleTierlistSchema.safeParse({ id: ID, releaseDate: "2026-10-01" }).success).toBe(true);
  });

  it.each(["10/01/2026", "2026-1-1", "not-a-date", ""])("rejects malformed date %s", (releaseDate) => {
    expect(scheduleTierlistSchema.safeParse({ id: ID, releaseDate }).success).toBe(false);
  });
});

describe("duplicateTierlistSchema", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("requires a valid slug-shaped newSlug", () => {
    expect(duplicateTierlistSchema.safeParse({ id: ID, newSlug: "Invalid Slug" }).success).toBe(false);
    expect(duplicateTierlistSchema.safeParse({ id: ID, newSlug: "valid-slug" }).success).toBe(true);
  });
});

describe("setTierlistItemsSchema", () => {
  const ID = "11111111-1111-4111-8111-111111111111";

  it("accepts a minimal valid item", () => {
    expect(
      setTierlistItemsSchema.safeParse({ id: ID, items: [{ label: "A", sortOrder: 0 }] }).success,
    ).toBe(true);
  });

  it("rejects an empty item list", () => {
    expect(setTierlistItemsSchema.safeParse({ id: ID, items: [] }).success).toBe(false);
  });

  it("rejects a non-https image URL", () => {
    expect(
      setTierlistItemsSchema.safeParse({
        id: ID,
        items: [{ label: "A", imageUrl: "http://insecure.example.com/x.png", sortOrder: 0 }],
      }).success,
    ).toBe(false);
  });

  it("accepts an https image URL", () => {
    expect(
      setTierlistItemsSchema.safeParse({
        id: ID,
        items: [{ label: "A", imageUrl: "https://example.com/x.png", sortOrder: 0 }],
      }).success,
    ).toBe(true);
  });

  it("rejects a negative sort order", () => {
    expect(
      setTierlistItemsSchema.safeParse({ id: ID, items: [{ label: "A", sortOrder: -1 }] }).success,
    ).toBe(false);
  });

  it("rejects a label over 120 characters", () => {
    expect(
      setTierlistItemsSchema.safeParse({ id: ID, items: [{ label: "x".repeat(121), sortOrder: 0 }] })
        .success,
    ).toBe(false);
  });
});
