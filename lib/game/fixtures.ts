import type { DailyGame } from "./schema";

/**
 * Sample game data for local visual review and e2e tests only. NOT production
 * content and never inserted into any database — application behaviour must not
 * depend on these specific values (docs/MANUAL.md sec 33). Consumed only by the
 * dev-only preview route (`app/dev/preview`).
 */
export const SAMPLE_DAILY_GAME: DailyGame = {
  id: "5a3f1e00-0000-4000-8000-000000000001",
  slug: "sample-fast-food-fries",
  title: "Fast Food Fries",
  prompt: "Rank the fries. No fence-sitting.",
  releaseDate: "2026-09-08",
  tierConfig: ["S", "A", "B", "C", "F", "N/A"],
  items: [
    "McDonald's",
    "Five Guys",
    "In-N-Out",
    "Wendy's",
    "Burger King",
    "Chick-fil-A waffle fries",
    "Arby's curly fries",
    "Shake Shack crinkle-cut",
    "Popeyes Cajun fries",
    "Culver's",
  ].map((label, i) => ({
    id: `5a3f1e00-0000-4000-8000-0000000000${(i + 16).toString(16)}`,
    label,
    imageUrl: null,
    sortOrder: i,
  })),
};
