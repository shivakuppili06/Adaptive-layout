/**
 * surfaces.ts — Surface constraint profiles.
 *
 * A surface describes WHERE an ad renders and what hard physical/UX
 * constraints apply there. Adding a new surface never requires touching
 * resolver.ts — that's the extensibility bar this file is designed to hit.
 */

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type ViewingDistance = "near" | "far";

export interface SurfaceProfile {
  id: string;
  width: number;
  height: number;
  /** Inset from the physical edge that content must not cross. */
  safeArea: SafeArea;
  /** Minimum square hit-target size (px) for any interactive element. */
  minTapTarget?: number;
  /** How far the viewer typically is — drives minimum text size. */
  viewingDistance?: ViewingDistance;
  /** Absolute minimum font size (px), independent of viewingDistance. */
  minTextSize?: number;
  /** True if the surface is touch-only (kiosk, mobile) — enforces minTapTarget on all actionable elements. */
  touchOnly?: boolean;
}

const noSafeArea: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

export const surfaces = {
  mobilePortrait: {
    id: "mobilePortrait",
    width: 320,
    height: 480,
    safeArea: { top: 16, right: 12, bottom: 16, left: 12 },
    minTapTarget: 44,
    touchOnly: true,
  },
  mobileLandscape: {
    id: "mobileLandscape",
    width: 480,
    height: 270,
    safeArea: { top: 10, right: 16, bottom: 10, left: 16 },
    minTapTarget: 44,
    touchOnly: true,
  },
  broadcastLowerThird: {
    id: "broadcastLowerThird",
    width: 1920,
    height: 250,
    safeArea: { top: 8, right: 60, bottom: 8, left: 60 },
    viewingDistance: "far",
    minTextSize: 32,
  },
  retailKiosk: {
    id: "retailKiosk",
    width: 1080,
    height: 1080,
    safeArea: { top: 24, right: 24, bottom: 24, left: 24 },
    minTapTarget: 60,
    touchOnly: true,
  },
  // Intentionally cramped — used in the demo to prove priority degradation.
  // Deliberately near-square (stays in "hybrid" composition mode) but with
  // too little height for every element at ideal size, forcing the
  // resolver to shrink/drop the lowest-priority elements (branding first).
  retailKioskCramped: {
    id: "retailKioskCramped",
    width: 400,
    height: 212,
    safeArea: { top: 16, right: 16, bottom: 16, left: 16 },
    minTapTarget: 60,
    touchOnly: true,
  },
} as const satisfies Record<string, SurfaceProfile>;

export type SurfaceKey = keyof typeof surfaces;

/** Runtime validation for a surface supplied at runtime (e.g. the live interview's "unknown 5th surface"). */
export function validateSurface(s: SurfaceProfile): void {
  if (s.width <= 0 || s.height <= 0) {
    throw new Error(`[surface:${s.id}] width/height must be positive.`);
  }
  const sa = s.safeArea ?? noSafeArea;
  if (sa.left + sa.right >= s.width || sa.top + sa.bottom >= s.height) {
    throw new Error(`[surface:${s.id}] safeArea consumes the entire surface — nothing left to lay out.`);
  }
  if (s.minTapTarget !== undefined && s.minTapTarget <= 0) {
    throw new Error(`[surface:${s.id}] minTapTarget must be positive.`);
  }
}
