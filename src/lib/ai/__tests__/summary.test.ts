import { describe, expect, it } from "vitest";
import { buildFactSheet, percentChange, type WeeklySummaryInput } from "../summary";

const BASE: WeeklySummaryInput = {
  views: 132,
  clicks: 41,
  uniqueVisitors: 98,
  ctr: 31.1,
  previousViews: 100,
  previousClicks: 30,
  topSources: [
    { label: "instagram.com", count: 80 },
    { label: "Direct", count: 32 },
  ],
  topLinks: [{ title: "Spotify", clicks: 25 }],
};

describe("percentChange", () => {
  it("computes the change the summary quotes", () => {
    expect(percentChange(132, 100)).toBe(32);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 100)).toBe(0);
  });

  it("rounds to whole percentage points", () => {
    expect(percentChange(103, 97)).toBe(6);
  });

  it("returns null when there is no baseline, rather than dividing by zero", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe("buildFactSheet", () => {
  it("hands the model finished figures, never raw operands to combine", () => {
    const sheet = buildFactSheet(BASE);
    expect(sheet).toContain("evolution_vues: +32%");
    expect(sheet).toContain("evolution_clics: +37%");
  });

  it("includes both periods so the model can name them without inferring", () => {
    const sheet = buildFactSheet(BASE);
    expect(sheet).toContain("vues_cette_semaine: 132");
    expect(sheet).toContain("vues_semaine_precedente: 100");
  });

  it("marks an incomputable change instead of emitting a bogus percentage", () => {
    const sheet = buildFactSheet({ ...BASE, previousViews: 0, previousClicks: 0 });
    expect(sheet).toContain("evolution_vues: non calculable");
    expect(sheet).toContain("evolution_clics: non calculable");
    expect(sheet).not.toMatch(/evolution_vues: [+-]?\d+%/);
  });

  it("signs a decline explicitly", () => {
    const sheet = buildFactSheet({ ...BASE, views: 60, previousViews: 100 });
    expect(sheet).toContain("evolution_vues: -40%");
  });

  it("lists the top sources and links with their counts", () => {
    const sheet = buildFactSheet(BASE);
    expect(sheet).toContain("instagram.com (80)");
    expect(sheet).toContain("Spotify (25)");
  });

  it("omits breakdown lines entirely when there is nothing to report", () => {
    const sheet = buildFactSheet({ ...BASE, topSources: [], topLinks: [] });
    expect(sheet).not.toContain("sources_principales");
    expect(sheet).not.toContain("liens_les_plus_cliques");
  });

  it("caps each breakdown at three entries to keep the sentence short", () => {
    const sheet = buildFactSheet({
      ...BASE,
      topSources: Array.from({ length: 8 }, (_, i) => ({ label: `s${i}.com`, count: 10 - i })),
    });
    expect(sheet).toContain("s0.com");
    expect(sheet).toContain("s2.com");
    expect(sheet).not.toContain("s3.com");
  });
});
