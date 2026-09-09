/**
 * Tier label -> Tailwind classes. Standard S/A/B/C/D use the tier token palette;
 * any other (custom) tier label falls back to a neutral treatment and stays
 * fully functional. Nothing outside this file branches on the literal values.
 */

export type TierStyle = {
  /** the letter chip and the monogram badge on a placed card */
  chip: string;
  /** left accent bar on a card sitting in this tier */
  bar: string;
  /** resting lane wash (very faint) */
  lane: string;
  /** lane wash + ring when it is an active drop target */
  laneOver: string;
};

const KNOWN: Record<string, TierStyle> = {
  S: {
    chip: "bg-tier-s text-tier-s-foreground border-tier-s-border",
    bar: "border-l-tier-s-border",
    lane: "bg-tier-s/[0.05]",
    laneOver: "bg-tier-s/[0.12] ring-2 ring-tier-s-border",
  },
  A: {
    chip: "bg-tier-a text-tier-a-foreground border-tier-a-border",
    bar: "border-l-tier-a-border",
    lane: "bg-tier-a/[0.05]",
    laneOver: "bg-tier-a/[0.12] ring-2 ring-tier-a-border",
  },
  B: {
    chip: "bg-tier-b text-tier-b-foreground border-tier-b-border",
    bar: "border-l-tier-b-border",
    lane: "bg-tier-b/[0.06]",
    laneOver: "bg-tier-b/[0.14] ring-2 ring-tier-b-border",
  },
  C: {
    chip: "bg-tier-c text-tier-c-foreground border-tier-c-border",
    bar: "border-l-tier-c-border",
    lane: "bg-tier-c/[0.05]",
    laneOver: "bg-tier-c/[0.12] ring-2 ring-tier-c-border",
  },
  D: {
    chip: "bg-tier-d text-tier-d-foreground border-tier-d-border",
    bar: "border-l-tier-d-border",
    lane: "bg-tier-d/[0.05]",
    laneOver: "bg-tier-d/[0.12] ring-2 ring-tier-d-border",
  },
};

const NEUTRAL: TierStyle = {
  chip: "bg-surface-muted text-foreground border-border",
  bar: "border-l-border",
  lane: "bg-accent/[0.03]",
  laneOver: "bg-accent/[0.08] ring-2 ring-accent",
};

export function tierStyle(tier: string): TierStyle {
  return KNOWN[tier.toUpperCase()] ?? NEUTRAL;
}
