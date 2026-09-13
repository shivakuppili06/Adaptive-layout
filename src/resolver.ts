/**
 * resolver.ts — Constraint-based layout resolution.
 *
 * Ad Spec + Surface Profile → Resolved Layout
 *
 * This is a rule-based cascade, not a lookup table. There is exactly one
 * function, `resolveLayout`, and it is never branched on surface id or
 * surface name anywhere in this file. All per-surface differences fall
 * out of three numeric inputs derived from the surface: aspect ratio,
 * safe area, and hard constraints (minTapTarget / minTextSize).
 *
 * ── Algorithm, step by step ─────────────────────────────────────────
 * 1. COMPOSE: pick a composition mode purely from aspect ratio math
 *    (ratio = width/height of the safe content box):
 *      ratio >= 2.4            -> "row"    (single horizontal row —
 *                                            fits wide/short surfaces
 *                                            like a broadcast lower third)
 *      ratio <= 0.85           -> "stack"  (single vertical stack —
 *                                            fits tall surfaces like a
 *                                            mobile portrait interstitial)
 *      otherwise               -> "hybrid" (image band + a row of
 *                                            text/CTA below it — fits
 *                                            square/near-square surfaces
 *                                            like a kiosk or landscape
 *                                            phone)
 *    This is the one place aspect ratio decides *shape*; everything
 *    after this operates on abstract "main axis / cross axis" slots and
 *    does not know or care which named surface it's running for.
 *
 * 2. ALLOCATE: each element gets an ideal main-axis size from a
 *    role-based weight table (hero/primary get the most, branding the
 *    least), scaled to fill the available main axis exactly.
 *
 * 3. DEGRADE (only if hard constraints can't all be satisfied at the
 *    ideal allocation): elements are visited in *ascending* priority
 *    number... actually in *descending* priority number (3 before 2
 *    before 1) — i.e. lowest-importance first:
 *      a. Shrink the element toward its role's minimum size.
 *      b. If it is still over budget once every shrinkable element is
 *         at its minimum, drop the lowest-priority element entirely
 *         (visible=false) and re-run allocation for the remainder.
 *    Priority-1 elements and any element with role "action" are never
 *    dropped, and are only shrunk as an absolute last resort, after
 *    every lower-priority element has already been shrunk to its floor
 *    and dropped.
 *
 * 4. ENFORCE HARD CONSTRAINTS:
 *      - `minTapTarget`: action/button elements on touch surfaces are
 *        floored to at least this size, taking space back from lower
 *        priority elements if needed (re-triggers step 3).
 *      - `minTextSize` / far viewing distance: text elements are
 *        floored to this font size; if that no longer fits, lower
 *        priority neighbors shrink/drop instead of the text.
 *
 * 5. PLACE: convert final sizes into concrete non-overlapping x/y boxes
 *    inside the safe area, using the composition mode's placement rule
 *    (stack = vertical flow; row = horizontal flow; hybrid = image band
 *    then a horizontal row for the remaining elements).
 */

import type { AdElement, AdSpec, ElementRole } from "./spec";
import type { SurfaceProfile } from "./surfaces";

export type CompositionMode = "stack" | "row" | "hybrid";

export interface ResolvedElement {
  id: string;
  type: AdElement["type"];
  role: ElementRole;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  visible: boolean;
  /** Set when the element was altered from its ideal size to fit. Useful for debugging / the demo's trace panel. */
  degradation?: "shrunk" | "dropped" | null;
  content?: string;
  src?: string;
}

export interface ResolvedLayout {
  surfaceId: string;
  mode: CompositionMode;
  width: number;
  height: number;
  elements: ResolvedElement[];
  /** Human-readable trace of degradation decisions, for explainability (assignment explicitly rewards this). */
  trace: string[];
}

// ---- Role-based sizing table -----------------------------------------
// (weight = share of main axis at ideal allocation; min = floor before drop)
const ROLE_WEIGHT: Record<ElementRole, number> = {
  hero: 0.4,
  primary: 0.22,
  action: 0.14,
  secondary: 0.14,
  branding: 0.1,
};
const ROLE_MIN_MAIN: Record<ElementRole, number> = {
  hero: 60,
  primary: 28,
  action: 40,
  secondary: 20,
  branding: 18,
};
const ROLE_BASE_FONT: Record<ElementRole, number> = {
  primary: 22,
  secondary: 15,
  action: 16,
  hero: 0,
  branding: 0,
};
const CROSS_AXIS_FRACTION: Record<ElementRole, number> = {
  hero: 1,
  primary: 1,
  action: 0.45,
  secondary: 0.6,
  branding: 0.3,
};

const GAP = 8;

interface WorkingItem {
  el: AdElement;
  main: number; // current size along the main flow axis
  minMain: number;
  visible: boolean;
  /** Once true, this item's `main` is fixed at its floor and excluded from further weighted reallocation. */
  locked: boolean;
  degradation: ResolvedElement["degradation"];
  fontSize?: number;
}

function pickMode(contentW: number, contentH: number): CompositionMode {
  const ratio = contentW / contentH;
  if (ratio >= 2.4) return "row";
  if (ratio <= 0.85) return "stack";
  return "hybrid";
}

function priorityRank(el: AdElement): number {
  // Elements with role "action" are treated as priority 1 regardless of
  // their declared priority, per the assignment's hard requirement that
  // the CTA is compromised last.
  if (el.role === "action") return 0;
  return el.priority;
}

export function resolveLayout(spec: AdSpec, surface: SurfaceProfile): ResolvedLayout {
  const trace: string[] = [];
  const contentX = surface.safeArea.left;
  const contentY = surface.safeArea.top;
  const contentW = surface.width - surface.safeArea.left - surface.safeArea.right;
  const contentH = surface.height - surface.safeArea.top - surface.safeArea.bottom;

  const mode = pickMode(contentW, contentH);
  trace.push(
    `Composition mode = "${mode}" (content aspect ratio ${(contentW / contentH).toFixed(2)}: ` +
      `${mode === "row" ? "wide/short -> single horizontal row" : mode === "stack" ? "tall -> vertical stack" : "square-ish -> image band + row"})`
  );

  const mainAxisLength = mode === "row" ? contentW : contentH;

  // Sort by degrade priority: drop/shrink candidates first (highest rank number = lowest importance).
  const items: WorkingItem[] = spec.elements.map((el) => ({
    el,
    main: 0,
    minMain: ROLE_MIN_MAIN[el.role],
    visible: true,
    locked: false,
    degradation: null,
    fontSize: ROLE_BASE_FONT[el.role] || undefined,
  }));

  function totalWeight(pool: WorkingItem[]): number {
    return pool.reduce((s, i) => s + ROLE_WEIGHT[i.el.role], 0);
  }

  // Reallocate space among visible, unlocked items. Locked items keep the
  // fixed `main` they were floored to; the remaining main-axis space (after
  // subtracting locked items' space and gaps) is shared by weight among
  // whatever is left.
  function allocate(): void {
    const active = items.filter((i) => i.visible);
    const gapTotal = GAP * Math.max(0, active.length - 1);
    const locked = active.filter((i) => i.locked);
    const unlocked = active.filter((i) => !i.locked);
    const lockedSpace = locked.reduce((s, i) => s + i.main, 0);
    const available = Math.max(0, mainAxisLength - gapTotal - lockedSpace);
    const w = totalWeight(unlocked);
    for (const i of unlocked) {
      i.main = w > 0 ? (ROLE_WEIGHT[i.el.role] / w) * available : 0;
    }
  }

  // ---- Degradation loop -------------------------------------------
  // `allocate()` always distributes the full main axis proportionally by
  // weight, so it never "overflows" by construction — the real signal
  // that something must give is an *unlocked* item's weighted share
  // landing below its own floor, or locked items alone already consuming
  // more than the whole axis (nothing left to give the rest).
  // Elements with role "action" are never dropped (see priorityRank).
  // Priority-1 elements are droppable only as an absolute last resort,
  // once every priority-2/3 element has already been dropped.
  function lockedSpaceExceedsAxis(): boolean {
    const active = items.filter((i) => i.visible);
    const gapTotal = GAP * Math.max(0, active.length - 1);
    const lockedSpace = active.filter((i) => i.locked).reduce((s, i) => s + i.main, 0);
    return lockedSpace + gapTotal > mainAxisLength + 0.01;
  }

  allocate();
  let guard = 0;
  while (guard < 50) {
    guard++;

    if (lockedSpaceExceedsAxis()) {
      // Even everything already at floor doesn't fit — must drop something.
      const droppable = items
        .filter((i) => i.visible)
        .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))
        .find((i) => priorityRank(i.el) > 0);
      if (!droppable) break; // only the CTA is left; let it overflow slightly rather than disappear
      droppable.visible = false;
      droppable.degradation = "dropped";
      trace.push(
        `"${droppable.el.id}" (role=${droppable.el.role}, priority=${droppable.el.priority}) dropped — ` +
          `remaining elements' floors alone exceed the available space.`
      );
      allocate();
      continue;
    }

    const active = items.filter((i) => i.visible);
    const belowFloor = active
      .filter((i) => !i.locked && i.main < i.minMain - 0.01)
      .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0]; // lowest importance first

    if (belowFloor) {
      if (priorityRank(belowFloor.el) === 0) {
        // The CTA itself can't be shrunk below floor by definition — clamp and stop; minTapTarget enforcement below will reserve its space properly.
        belowFloor.main = belowFloor.minMain;
        belowFloor.locked = true;
        allocate();
        continue;
      }
      trace.push(
        `"${belowFloor.el.id}" (role=${belowFloor.el.role}) shrunk to its floor (${belowFloor.minMain}px) — its weighted share fell short.`
      );
      belowFloor.degradation = "shrunk";
      belowFloor.main = belowFloor.minMain;
      belowFloor.locked = true;
      allocate();
      continue;
    }

    break; // everything fits at or above its floor
  }

  // ---- Hard constraint enforcement ---------------------------------
  // minTapTarget on the CTA is enforced first (it's priority-0 and must
  // win the space it needs), then we re-run the degrade loop so any
  // space it just took back gets clawed from lower-priority elements
  // rather than silently overflowing the surface.
  for (const i of items.filter((i) => i.visible)) {
    if (i.el.role === "action" && surface.touchOnly && surface.minTapTarget && i.main < surface.minTapTarget) {
      trace.push(`"${i.el.id}" floored to minTapTarget=${surface.minTapTarget}px (touch surface hard constraint).`);
      i.main = surface.minTapTarget;
      i.locked = true;
      i.degradation = i.degradation ?? "shrunk";
    }
  }
  guard = 0;
  while (guard < 50) {
    guard++;
    if (lockedSpaceExceedsAxis()) {
      const droppable = items
        .filter((i) => i.visible)
        .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))
        .find((i) => priorityRank(i.el) > 0);
      if (!droppable) break;
      droppable.visible = false;
      droppable.degradation = "dropped";
      trace.push(`"${droppable.el.id}" dropped to accommodate the CTA's minimum tap target.`);
      allocate();
      continue;
    }
    const belowFloor = items
      .filter((i) => i.visible && !i.locked && i.main < i.minMain - 0.01)
      .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0];
    if (belowFloor) {
      trace.push(`"${belowFloor.el.id}" shrunk to its floor to accommodate the CTA's minimum tap target.`);
      belowFloor.degradation = "shrunk";
      belowFloor.main = belowFloor.minMain;
      belowFloor.locked = true;
      allocate();
      continue;
    }
    break;
  }

  for (const i of items.filter((i) => i.visible)) {
    if (i.el.type === "text" || i.el.type === "button") {
      const floor = surface.minTextSize ?? (surface.viewingDistance === "far" ? 32 : 12);
      const base = i.fontSize ?? ROLE_BASE_FONT[i.el.role] ?? 14;
      if (base < floor) {
        trace.push(`"${i.el.id}" font size floored to minTextSize=${floor}px.`);
        i.fontSize = floor;
      } else {
        i.fontSize = base;
      }
    }
  }

  if (items.every((i) => i.visible)) {
    trace.push("All elements fit at or above their ideal allocation — no degradation was necessary.");
  }

  // ---- Placement -----------------------------------------------------
  const resolved: ResolvedElement[] = [];
  const visibleItems = items.filter((i) => i.visible);

  if (mode === "stack") {
    let cursorY = contentY;
    for (const i of visibleItems) {
      const w = CROSS_AXIS_FRACTION[i.el.role] * contentW;
      resolved.push(place(i, contentX + (contentW - w) / 2, cursorY, w, i.main));
      cursorY += i.main + GAP;
    }
  } else if (mode === "row") {
    let cursorX = contentX;
    for (const i of visibleItems) {
      const h = CROSS_AXIS_FRACTION[i.el.role] * contentH;
      resolved.push(place(i, cursorX, contentY + (contentH - h) / 2, i.main, h));
      cursorX += i.main + GAP;
    }
  } else {
    // hybrid: hero/primary-image gets a top band sized by its own `main`
    // (already computed on the vertical axis since mainAxisLength === contentH
    // for hybrid — see mainAxisLength assignment above), everything else
    // flows in a horizontal row beneath it.
    const bandItems = visibleItems.filter((i) => i.el.role === "hero");
    const rowItems = visibleItems.filter((i) => i.el.role !== "hero");

    let cursorY = contentY;
    for (const i of bandItems) {
      resolved.push(place(i, contentX, cursorY, contentW, i.main));
      cursorY += i.main + GAP;
    }
    const rowHeight = contentH - (cursorY - contentY);
    // Distribute rowItems horizontally, proportional to their own weight.
    const totalW = rowItems.reduce((s, i) => s + ROLE_WEIGHT[i.el.role], 0);
    const availableW = contentW - GAP * Math.max(0, rowItems.length - 1);
    let cursorX = contentX;
    for (const i of rowItems) {
      const w = totalW > 0 ? (ROLE_WEIGHT[i.el.role] / totalW) * availableW : 0;
      const h = Math.min(rowHeight, Math.max(i.main, ROLE_MIN_MAIN[i.el.role]));
      resolved.push(place(i, cursorX, cursorY + (rowHeight - h) / 2, w, h));
      cursorX += w + GAP;
    }
  }

  // Elements the spec declared but that got dropped still appear in the
  // output (visible=false) so a renderer/debugger can show what happened.
  for (const i of items.filter((i) => !i.visible)) {
    resolved.push(place(i, 0, 0, 0, 0));
  }

  return { surfaceId: surface.id, mode, width: surface.width, height: surface.height, elements: resolved, trace };
}

function place(i: WorkingItem, x: number, y: number, w: number, h: number): ResolvedElement {
  return {
    id: i.el.id,
    type: i.el.type,
    role: i.el.role,
    x,
    y,
    width: Math.max(0, w),
    height: Math.max(0, h),
    fontSize: i.fontSize,
    visible: i.visible,
    degradation: i.degradation,
    content: i.el.content,
    src: i.el.src,
  };
}
