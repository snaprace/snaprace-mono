import { describe, expect, it } from "vitest";

import {
  normalisePercentage,
  resolveTier,
  PERFORMANCE_TIERS,
} from "@/components/performance/PerformanceTierBadge";

describe("normalisePercentage", () => {
  it("returns numbers directly", () => {
    expect(normalisePercentage(94)).toBe(94);
  });

  it("parses numeric strings", () => {
    expect(normalisePercentage("44.5")).toBeCloseTo(44.5);
  });

  it("returns null for blank strings", () => {
    expect(normalisePercentage("   ")).toBeNull();
  });

  it("returns null for non-numeric values", () => {
    expect(normalisePercentage("fast" as unknown as string)).toBeNull();
  });
});

describe("resolveTier", () => {
  it("returns Legend tier for percentages above 90", () => {
    const tier = resolveTier(93.2);
    expect(tier?.key).toBe("legend");
    expect(tier?.percentage).toBeCloseTo(93.2);
  });

  it("matches boundaries inclusively", () => {
    const boundary = PERFORMANCE_TIERS.find((t) => t.key === "challenger");
    const tier = resolveTier(boundary?.minPercentage ?? 40);
    expect(tier?.key).toBe("challenger");
  });

  it("falls back to lowest tier when percentage is valid but small", () => {
    const tier = resolveTier(12);
    expect(tier?.key).toBe("rising-runner");
  });

  it("returns null when percentage cannot be resolved", () => {
    expect(resolveTier(null)).toBeNull();
  });
});
