/**
 * Ad Spec + Surface Profile → Resolved Layout
 * 
 * Resolves layouts by picking a composition mode based on aspect ratio,
 * allocating space by priority weights, and degrading (shrinking/dropping)
 * lower-priority elements when space runs out.
 */

import type { AdElement, AdSpec, ElementRole } from "./spec";
import type { SurfaceProfile } from "./surfaces";

export type CompositionMode = "stack" | "row" | "hybrid";

export interface TextMeasurementProvider {
  /**
   * Measures text and optionally computes a truncated version with ellipsis if it overflows.
   * Returns lines and the actual fitted text.
   */
  measureText(
    text: string,
    fontSize: number,
    maxWidth: number,
    maxHeight: number,
    fontWeight: number | string,
    maxLines?: number
  ): { width: number; height: number; lines: number; fittedText: string; truncated: boolean };
}

export interface ConstraintIssue {
  severity: "warning" | "error";
  elementId?: string;
  constraint: string;
  message: string;
}

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
  /** Set when the element was altered from its ideal size to fit. */
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
  /** Human-readable trace of degradation decisions. */
  trace: string[];
  /** Structured validation warnings/errors generated during resolution. */
  issues: ConstraintIssue[];
}

// ---- Role-based sizing table -----------------------------------------
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
  fittedText?: string;
}

function pickMode(contentW: number, contentH: number): CompositionMode {
  const ratio = contentW / contentH;
  if (ratio >= 2.4) return "row";
  if (ratio <= 0.85) return "stack";
  return "hybrid";
}

function priorityRank(el: AdElement): number {
  return el.priority;
}

export function resolveLayout(spec: AdSpec, surface: SurfaceProfile, textProvider?: TextMeasurementProvider): ResolvedLayout {
  const trace: string[] = [];
  const issues: ConstraintIssue[] = [];

  // Basic validation logging during resolve
  if (surface.width <= 0 || surface.height <= 0) {
    issues.push({ severity: "error", constraint: "dimensions", message: "Surface dimensions must be positive." });
  }

  const contentX = surface.safeArea.left;
  const contentY = surface.safeArea.top;
  const contentW = surface.width - surface.safeArea.left - surface.safeArea.right;
  const contentH = surface.height - surface.safeArea.top - surface.safeArea.bottom;

  if (contentW <= 0 || contentH <= 0) {
    issues.push({ severity: "error", constraint: "safeArea", message: "Safe area consumes entire surface." });
  }

  const mode = pickMode(contentW, contentH);
  trace.push(
    `Composition mode = "${mode}" (content aspect ratio ${(contentW / contentH).toFixed(2)})`
  );

  const mainAxisLength = mode === "row" ? contentW : contentH;

  const items: WorkingItem[] = spec.elements.map((el) => ({
    el,
    main: 0,
    minMain: ROLE_MIN_MAIN[el.role],
    visible: true,
    locked: false,
    degradation: null,
    fontSize: ROLE_BASE_FONT[el.role] || undefined,
    fittedText: el.content,
  }));

  function totalWeight(pool: WorkingItem[]): number {
    return pool.reduce((s, i) => s + ROLE_WEIGHT[i.el.role], 0);
  }

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
      const droppable = items
        .filter((i) => i.visible)
        .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0];
      
      if (!droppable) break; 
      
      droppable.visible = false;
      droppable.degradation = "dropped";
      trace.push(
        `"${droppable.el.id}" (priority=${droppable.el.priority}) dropped — remaining floors exceed available space.`
      );
      allocate();
      continue;
    }

    const active = items.filter((i) => i.visible);
    const belowFloor = active
      .filter((i) => !i.locked && i.main < i.minMain - 0.01)
      .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0];

    if (belowFloor) {
      trace.push(`"${belowFloor.el.id}" shrunk to its floor (${belowFloor.minMain}px).`);
      belowFloor.degradation = "shrunk";
      belowFloor.main = belowFloor.minMain;
      belowFloor.locked = true;
      allocate();
      continue;
    }

    // Text measurement / truncation pass
    if (textProvider) {
      let overflowResolved = false;
      for (const i of items.filter(i => i.visible && (i.el.type === "text" || i.el.type === "button"))) {
         const w = mode === "stack" ? CROSS_AXIS_FRACTION[i.el.role] * contentW : i.main;
         const h = mode === "row" ? CROSS_AXIS_FRACTION[i.el.role] * contentH : i.main;
         
         const metrics = textProvider.measureText(
           i.el.content || "", 
           i.fontSize || 14, 
           w, 
           h,
           i.el.role === "primary" ? 700 : 500,
           i.el.maxLines
         );

         if (metrics.truncated && i.fittedText !== metrics.fittedText) {
             trace.push(`"${i.el.id}" truncated to fit available bounds/lines.`);
             i.fittedText = metrics.fittedText;
             i.degradation = "shrunk";
             // Force reallocation or at least mark it processed
             overflowResolved = true;
         } else if (metrics.lines > 1 && !metrics.truncated && i.fittedText !== metrics.fittedText) {
             trace.push(`"${i.el.id}" wrapped to ${metrics.lines} lines.`);
             i.fittedText = metrics.fittedText;
             overflowResolved = true;
         }
      }
      if (overflowResolved) continue;
    }

    break; 
  }

  // ---- Hard constraint enforcement ---------------------------------
  // minTapTarget enforced for ALL action elements based on priority.
  const actionItems = items.filter((i) => i.visible && i.el.role === "action");
  for (const i of actionItems) {
    if (surface.touchOnly && surface.minTapTarget && i.main < surface.minTapTarget) {
      trace.push(`"${i.el.id}" floored to minTapTarget=${surface.minTapTarget}px.`);
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
        .filter((i) => i.visible && i.el.role !== "action") // Try to protect actions if possible
        .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0];
      
      // If we MUST drop an action, pick the lowest priority one
      const finalDroppable = droppable || items.filter(i => i.visible).sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0];

      if (!finalDroppable) break;
      finalDroppable.visible = false;
      finalDroppable.degradation = "dropped";
      trace.push(`"${finalDroppable.el.id}" dropped to accommodate hard constraints.`);
      allocate();
      continue;
    }
    
    const belowFloor = items
      .filter((i) => i.visible && !i.locked && i.main < i.minMain - 0.01)
      .sort((a, b) => priorityRank(b.el) - priorityRank(a.el))[0];
      
    if (belowFloor) {
      trace.push(`"${belowFloor.el.id}" shrunk to its floor to accommodate hard constraints.`);
      belowFloor.degradation = "shrunk";
      belowFloor.main = belowFloor.minMain;
      belowFloor.locked = true;
      allocate();
      continue;
    }
    break;
  }

  // Min Text Size
  for (const i of items.filter((i) => i.visible)) {
    if (i.el.type === "text" || i.el.type === "button") {
      const floor = surface.minTextSize ?? (surface.viewingDistance === "far" ? 32 : 12);
      const base = i.fontSize ?? ROLE_BASE_FONT[i.el.role] ?? 14;
      if (base < floor) {
        trace.push(`"${i.el.id}" font size floored to minTextSize=${floor}px.`);
        i.fontSize = floor;
        if (textProvider) {
           const w = mode === "stack" ? CROSS_AXIS_FRACTION[i.el.role] * contentW : i.main;
           const h = mode === "row" ? CROSS_AXIS_FRACTION[i.el.role] * contentH : i.main;
           const fw = i.el.role === "primary" ? 700 : (i.el.type === "button" ? 600 : 500);
           const metrics = textProvider.measureText(i.el.content || "", floor, w, h, fw, i.el.maxLines);
           if (metrics.truncated) {
             i.fittedText = metrics.fittedText;
             trace.push(`"${i.el.id}" truncated after enforcing minTextSize.`);
           }
        }
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
    // hybrid: multiple heroes share the top band
    const bandItems = visibleItems.filter((i) => i.el.role === "hero");
    const rowItems = visibleItems.filter((i) => i.el.role !== "hero");

    let cursorY = contentY;
    
    if (bandItems.length > 0) {
      // Split the width among multiple heroes
      const heroGapTotal = GAP * (bandItems.length - 1);
      const heroWidth = Math.max(0, (contentW - heroGapTotal) / bandItems.length);
      let heroX = contentX;
      
      const maxHeroMain = Math.max(...bandItems.map(i => i.main));
      
      for (const i of bandItems) {
        resolved.push(place(i, heroX, cursorY, heroWidth, i.main));
        heroX += heroWidth + GAP;
      }
      cursorY += maxHeroMain + GAP;
    }

    const rowHeight = contentH - (cursorY - contentY);
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

  for (const i of items.filter((i) => !i.visible)) {
    resolved.push(place(i, 0, 0, 0, 0));
  }

  return { surfaceId: surface.id, mode, width: surface.width, height: surface.height, elements: resolved, trace, issues };
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
    content: i.fittedText,
    src: i.el.src,
  };
}
