import { tierStyle } from "@/components/game/tier-style";
import { DistributionBar } from "@/components/results/distribution-bar";
import type { ItemDistribution } from "@/lib/game/results";

/**
 * Landing-page demonstrations of what `/results` and friend comparison look
 * like (docs/MANUAL.md sec 8–11, 18). EVERY value in this file is hard-coded
 * fiction about a made-up "Pizza Toppings" Rankle — nothing is fetched,
 * nothing comes from today's game, so these can never leak a real result
 * before submission (docs/SECURITY.md sec 7). Each demo carries a visible
 * "Example" label so it can't be mistaken for live data.
 */

export const DEMO_TOPIC = "Pizza Toppings";

export function ExampleTag() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-sm border-2 border-ink bg-brand-yellow px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">
      Example · {DEMO_TOPIC}
    </span>
  );
}

function TierChip({ tier, size = "md" }: { tier: string; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "size-14 text-2xl" : "size-9 text-base";
  return (
    <span
      className={`grid ${dims} shrink-0 place-items-center rounded-md border-2 border-ink font-display font-extrabold ${tierStyle(tier).chip.replace(/border-\S+/, "")}`}
    >
      {tier}
    </span>
  );
}

export function DemoHottestTake() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-surface p-5 text-foreground shadow-[6px_6px_0_0_var(--ink)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-display text-xs font-extrabold uppercase tracking-widest text-accent">
          Your hottest take
        </figcaption>
        <ExampleTag />
      </div>
      <p className="font-display text-3xl font-extrabold leading-none tracking-tight">Pineapple</p>
      <dl className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">You</dt>
          <dd><TierChip tier="S" size="lg" /></dd>
        </div>
        <span aria-hidden className="font-display text-xl font-extrabold text-muted">vs</span>
        <div className="flex items-center gap-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Community</dt>
          <dd><TierChip tier="C" size="lg" /></dd>
        </div>
      </dl>
      <p className="text-sm text-muted">Two full tiers above everyone else. Bold.</p>
    </figure>
  );
}

const ANCHOVIES: ItemDistribution = {
  itemId: "demo-anchovies",
  scored: [
    { tier: "S", count: 41, pct: 0.34 },
    { tier: "A", count: 9, pct: 0.075 },
    { tier: "B", count: 6, pct: 0.05 },
    { tier: "C", count: 10, pct: 0.083 },
    { tier: "F", count: 54, pct: 0.452 },
  ],
  naCount: 18,
  naPct: 0.13,
  n: 120,
  avgWeight: null,
};

export function DemoControversy() {
  return (
    <figure className="flex flex-col gap-3 rounded-xl border-2 border-ink bg-surface p-5 text-foreground shadow-[6px_6px_0_0_var(--ink)] sm:rotate-[1.5deg]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-display text-xs font-extrabold uppercase tracking-widest text-accent">
          Most controversial
        </figcaption>
        <ExampleTag />
      </div>
      <p className="font-display text-3xl font-extrabold leading-none tracking-tight">Anchovies</p>
      <DistributionBar distribution={ANCHOVIES} />
      <p className="text-sm text-muted">Love it or hate it. Nobody&rsquo;s in the middle.</p>
    </figure>
  );
}

export function DemoFriendComparison() {
  return (
    <figure className="flex flex-col gap-4 rounded-xl border-2 border-ink bg-surface p-5 shadow-[6px_6px_0_0_var(--ink)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="font-display text-xs font-extrabold uppercase tracking-widest text-accent">
          You vs. Sam
        </figcaption>
        <ExampleTag />
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-5xl font-extrabold leading-none tabular-nums text-foreground">
            58%
          </span>
          <span className="text-sm font-semibold text-muted">agreement</span>
        </p>
        <p className="text-right text-xs text-muted">Same placement on 4 of 10</p>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border-2 border-dashed border-ink/30 bg-surface-muted p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Biggest disagreement</p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-extrabold text-foreground">Pineapple</span>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted">
            You <TierChip tier="S" /> Sam <TierChip tier="F" />
          </span>
        </div>
      </div>
    </figure>
  );
}
