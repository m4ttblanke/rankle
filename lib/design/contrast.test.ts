import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Accessibility gate for the design tokens in app/globals.css.
 *
 * Parses the OKLCH custom properties straight out of the stylesheet (the single
 * source of truth) and asserts WCAG 2.1 contrast for every text/background and
 * UI-component pair the tier board relies on. If a token value changes, this
 * test re-checks it — no duplicated palette table.
 */

function parseRootTokens(css: string): Record<string, [number, number, number]> {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) throw new Error("no :root block found in globals.css");
  const tokens: Record<string, [number, number, number]> = {};
  const re = /(--[\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;
  for (const m of root[1].matchAll(re)) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tokens;
}

function oklchToSrgb([L, C, hDeg]: [number, number, number]): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((x) => {
    const g = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, g));
  }) as [number, number, number];
}

function relativeLuminance(c: [number, number, number]): number {
  const [r, g, b] = oklchToSrgb(c).map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const T = parseRootTokens(css);
const TIERS = ["s", "a", "b", "c", "d"] as const;

describe("design tokens: WCAG contrast", () => {
  it("parses every expected token from globals.css", () => {
    const expected = [
      "--background",
      "--foreground",
      "--surface",
      "--surface-muted",
      "--border",
      "--muted",
      "--accent",
      "--accent-foreground",
      ...TIERS.flatMap((t) => [
        `--tier-${t}`,
        `--tier-${t}-foreground`,
        `--tier-${t}-border`,
      ]),
    ];
    for (const name of expected) expect(T, `missing ${name}`).toHaveProperty(name);
  });

  it.each([
    ["foreground on background >= 4.5:1", "--foreground", "--background", 4.5],
    ["muted (meta text) on background >= 4.5:1", "--muted", "--background", 4.5],
    ["muted on surface-muted >= 4.5:1", "--muted", "--surface-muted", 4.5],
    ["foreground on surface >= 4.5:1", "--foreground", "--surface", 4.5],
    ["accent-foreground on accent >= 4.5:1", "--accent-foreground", "--accent", 4.5],
    ["accent on background >= 3:1 (large/UI)", "--accent", "--background", 3.0],
  ])("%s", (_name, fg, bg, min) => {
    expect(contrastRatio(T[fg as string], T[bg as string])).toBeGreaterThanOrEqual(
      min as number,
    );
  });

  it.each(TIERS)("tier %s: letter label on fill >= 4.5:1", (t) => {
    expect(
      contrastRatio(T[`--tier-${t}-foreground`], T[`--tier-${t}`]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TIERS)("tier %s: outline on page background >= 3:1 (non-text UI)", (t) => {
    expect(
      contrastRatio(T[`--tier-${t}-border`], T["--background"]),
    ).toBeGreaterThanOrEqual(3.0);
  });
});
