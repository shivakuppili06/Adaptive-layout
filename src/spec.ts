/**
 * spec.ts — Ad content/intent definition.
 *
 * A spec describes WHAT an ad contains and HOW IMPORTANT each piece is,
 * independent of any surface. Nothing here knows about pixels, aspect
 * ratios, or devices — that's the resolver's job (resolver.ts).
 */

export type ElementType = "text" | "image" | "button";

/**
 * Semantic role of an element. The resolver uses role (not id) to decide
 * sizing rules (e.g. "action" elements get a minimum tap target on touch
 * surfaces; "secondary" text is the first to truncate).
 */
export type ElementRole =
  | "primary" // headline / dominant message
  | "hero" // main product image/visual
  | "action" // CTA button — never dropped, never shrunk below tap minimum
  | "secondary" // supporting text (price, subtext)
  | "branding"; // logo / lowest priority, first to degrade

/** Lower number = higher priority = degrades last. */
export type Priority = 1 | 2 | 3;

export interface AdElement {
  id: string;
  type: ElementType;
  role: ElementRole;
  priority: Priority;
  /** Text/button content to render. Optional for images. */
  content?: string;
  /** Image source. Required when type === "image". */
  src?: string;
  /** Intrinsic aspect ratio (w/h) used by the resolver for hero/branding images. */
  aspectRatio?: number;
}

export interface AdSpec {
  id: string;
  elements: readonly AdElement[];
}

/**
 * Enforces structural correctness at construction time for cases 
 * TS can't easily catch (duplicate ids, missing `src` on images).
 */
export function defineAd(input: { id?: string; elements: readonly AdElement[] }): AdSpec {
  const id = input.id ?? "ad";
  const seen = new Set<string>();
  for (const el of input.elements) {
    if (seen.has(el.id)) {
      throw new Error(`[defineAd] Duplicate element id "${el.id}" in spec "${id}".`);
    }
    seen.add(el.id);
    if (el.type === "image" && !el.src) {
      throw new Error(`[defineAd] Element "${el.id}" is type "image" but has no src.`);
    }
  }
  if (input.elements.length === 0) {
    throw new Error(`[defineAd] Spec "${id}" must have at least one element.`);
  }
  return { id, elements: input.elements };
}
