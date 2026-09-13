/**
 * Correctness gap-checks: no overlaps, no clipping, hard constraints, and priority degradation.
 */
import { describe, expect, it } from "vitest";
import { resolveLayout } from "./resolver";
import { surfaces, type SurfaceProfile, validateSurface } from "./surfaces";
import { demoAd } from "./demo-spec";

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const wildcardSurface: SurfaceProfile = {
  id: "walletTicketStub",
  width: 640,
  height: 220,
  safeArea: { top: 10, right: 14, bottom: 10, left: 14 },
  minTapTarget: 40,
  touchOnly: true,
};

const allSurfaces = { ...surfaces, wildcardSurface };

describe("resolveLayout — structural correctness", () => {
  for (const key of Object.keys(allSurfaces) as (keyof typeof allSurfaces)[]) {
    const surface: SurfaceProfile = allSurfaces[key];

    it(`[${key}] no two visible elements overlap`, () => {
      const layout = resolveLayout(demoAd, surface);
      const visible = layout.elements.filter((e) => e.visible);
      for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
          expect(rectsOverlap(visible[i], visible[j])).toBe(false);
        }
      }
    });

    it(`[${key}] no visible element is clipped outside surface bounds`, () => {
      const layout = resolveLayout(demoAd, surface);
      for (const el of layout.elements.filter((e) => e.visible)) {
        expect(el.x).toBeGreaterThanOrEqual(0);
        expect(el.y).toBeGreaterThanOrEqual(0);
        expect(el.x + el.width).toBeLessThanOrEqual(surface.width + 0.5);
        expect(el.y + el.height).toBeLessThanOrEqual(surface.height + 0.5);
      }
    });

    it(`[${key}] the CTA (action role) is always present and meets minTapTarget on touch surfaces`, () => {
      const layout = resolveLayout(demoAd, surface);
      const cta = layout.elements.find((e) => e.role === "action");
      expect(cta?.visible).toBe(true);
      if (surface.touchOnly && surface.minTapTarget) {
        expect(Math.min(cta!.width, cta!.height)).toBeGreaterThanOrEqual(surface.minTapTarget - 0.5);
      }
    });

    it(`[${key}] text respects minTextSize when the surface declares one`, () => {
      const layout = resolveLayout(demoAd, surface);
      if (surface.minTextSize) {
        for (const el of layout.elements.filter((e) => e.visible && e.type !== "image")) {
          expect(el.fontSize ?? 0).toBeGreaterThanOrEqual(surface.minTextSize);
        }
      }
    });
  }

  it("produces meaningfully different compositions for portrait vs. wide vs. square", () => {
    const portrait = resolveLayout(demoAd, surfaces.mobilePortrait);
    const wide = resolveLayout(demoAd, surfaces.broadcastLowerThird);
    const square = resolveLayout(demoAd, surfaces.retailKiosk);
    expect(new Set([portrait.mode, wide.mode, square.mode]).size).toBe(3);
  });

  it("degrades branding first, then secondary, before ever touching the primary headline or CTA on a cramped surface", () => {
    const layout = resolveLayout(demoAd, surfaces.retailKioskCramped);
    const branding = layout.elements.find((e) => e.role === "branding");
    const secondary = layout.elements.find((e) => e.role === "secondary");
    const headline = layout.elements.find((e) => e.role === "primary");
    const cta = layout.elements.find((e) => e.role === "action");
    
    // Priority order: branding (3), secondary (2), primary (1), action (0)
    expect(branding?.visible).toBe(false); // Lowest priority, first to drop
    expect(secondary?.degradation).toBeTruthy(); // Next lowest, must be shrunk or dropped
    expect(headline?.visible).toBe(true);
    expect(cta?.visible).toBe(true);
  });

  it("handles extreme aspect ratios saneley (ratio > 5, ratio < 0.5)", () => {
    const extremelyWide: SurfaceProfile = {
      id: "ultraWide",
      width: 2500,
      height: 200,
      safeArea: { top: 10, bottom: 10, left: 10, right: 10 },
    };
    const wideLayout = resolveLayout(demoAd, extremelyWide);
    expect(wideLayout.mode).toBe("row");
    // Assert no overlapping
    const visibleWide = wideLayout.elements.filter(e => e.visible);
    for (let i = 0; i < visibleWide.length; i++) {
      for (let j = i + 1; j < visibleWide.length; j++) {
        expect(rectsOverlap(visibleWide[i], visibleWide[j])).toBe(false);
      }
    }

    const extremelyTall: SurfaceProfile = {
      id: "ultraTall",
      width: 200,
      height: 2500,
      safeArea: { top: 10, bottom: 10, left: 10, right: 10 },
    };
    const tallLayout = resolveLayout(demoAd, extremelyTall);
    expect(tallLayout.mode).toBe("stack");
    // Assert no overlapping
    const visibleTall = tallLayout.elements.filter(e => e.visible);
    for (let i = 0; i < visibleTall.length; i++) {
      for (let j = i + 1; j < visibleTall.length; j++) {
        expect(rectsOverlap(visibleTall[i], visibleTall[j])).toBe(false);
      }
    }
  });

  it("throws a clear runtime error from validateSurface for invalid surfaces", () => {
    const broken = {
      id: "broken",
      width: 100,
      height: 100,
      safeArea: { top: 60, bottom: 60, left: 0, right: 0 },
    };
    expect(() => validateSurface(broken)).toThrow(/consumes the entire surface/);
    
    expect(() => validateSurface({ ...broken, safeArea: { top: -1, right: 0, bottom: 0, left: 0 }})).toThrow(/non-negative/);
    expect(() => validateSurface({ ...broken, width: 0, height: 100, safeArea: { top: 0, right: 0, bottom: 0, left: 0 }})).toThrow(/must be positive/);
  });

  it("distributes space horizontally among multiple heroes in hybrid mode", () => {
    const multiHeroSpec = {
      id: "multi-hero",
      elements: [
        { id: "h1", type: "image", role: "hero", priority: 1, src: "a" } as const,
        { id: "h2", type: "image", role: "hero", priority: 1, src: "b" } as const,
        { id: "cta", type: "button", role: "action", priority: 1, content: "Go" } as const,
      ]
    };
    const layout = resolveLayout(multiHeroSpec, surfaces.retailKiosk);
    const heroes = layout.elements.filter(e => e.role === "hero");
    expect(heroes.length).toBe(2);
    expect(heroes[0].y).toEqual(heroes[1].y);
    expect(heroes[0].x).toBeLessThan(heroes[1].x);
    expect(rectsOverlap(heroes[0], heroes[1])).toBe(false);
  });

  it("truncates text when using a TextMeasurementProvider", () => {
    const provider = {
      measureText: (_text: string, _fontSize: number, w: number, h: number, _weight: any, _maxLines?: number) => {
        // mock truncated result
        return { width: w, height: h, lines: 2, fittedText: "Truncated...", truncated: true };
      }
    };
    const layout = resolveLayout(demoAd, surfaces.retailKioskCramped, provider);
    const headline = layout.elements.find(e => e.role === "primary");
    expect(headline?.content).toBe("Truncated...");
  });
});
