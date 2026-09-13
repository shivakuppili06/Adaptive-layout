# Architecture

## Module boundaries

```
spec.ts        — WHAT an ad contains. No pixels, no surfaces, no rendering.
surfaces.ts     — WHERE it renders. No knowledge of ad content or resolution logic.
resolver.ts     — HOW spec + surface become concrete boxes. Pure function, framework-agnostic,
                  imports only types from spec.ts and surfaces.ts. No DOM, no React, no Canvas.
render-dom.tsx  — Draws a ResolvedLayout with absolutely-positioned divs. Zero layout decisions.
render-canvas.tsx — Draws the exact same ResolvedLayout to a <canvas>. Zero layout decisions.
demo-spec.ts    — One example AdSpec used by the demo.
App.tsx         — Surface picker + renderer toggle + trace panel. Wires the above together.
```

Each arrow below is a one-way dependency; nothing later in the chain reaches back:

```
spec.ts ─┐
         ├──▶ resolver.ts ──▶ ResolvedLayout ──▶ render-dom.tsx
surfaces.ts ─┘                              └──▶ render-canvas.tsx
```

### Could a new surface be added without touching the resolver?

Yes. `resolver.ts` never references a surface by id or name — every decision it makes is derived
from four numbers on the `SurfaceProfile` interface: `width`, `height`, `safeArea`, and the optional
hard constraints (`minTapTarget`, `minTextSize`, `viewingDistance`, `touchOnly`). The demo proves
this directly: `wildcardSurface` in `App.tsx` is a `SurfaceProfile` literal that exists nowhere in
`surfaces.ts` and is never imported by `resolver.ts`, yet resolves correctly the first time it's
passed in. Adding a real new surface is: add an object literal to `surfaces.ts` (or construct one
inline) satisfying `SurfaceProfile`, done.

### Could a new renderer be added without touching the resolver?

Yes — this is proven by `render-canvas.tsx` existing at all. Both renderers take a `ResolvedLayout`
and nothing else; neither imports `spec.ts`, `surfaces.ts`, or anything from `resolver.ts` beyond
the `ResolvedLayout` type. A hypothetical PDF or React-Native renderer would follow the identical
shape: iterate `layout.elements`, read `x/y/width/height/fontSize/type/content/src`, draw.

## Why a hand-rolled priority/weight model instead of a general solver

The brief explicitly discourages an over-engineered LP/constraint solver in favor of a
"well-reasoned priority-ordered algorithm." The model here is deliberately close to a flexbox
mental model — main axis, weights, floors — because:

1. **Explainability.** Every degradation decision produces one plain-English trace line
   (`"logo" shrunk to its floor (18px)`), which is what the live interview explicitly asks
   candidates to walk through. An LP solver's dual values are not a good answer to "why did the logo
   end up here."
2. **Determinism.** The same spec + surface always produces the same layout; there's no solver
   convergence or tie-breaking ambiguity to explain.
3. **Bounded iteration.** The degrade loop is `O(elements²)` worst case (at most one element is
   locked or dropped per iteration) — trivial for the 5-element demo spec and still trivial for
   specs an order of magnitude larger.

## Composition-mode selection is the one aspect-ratio-sensitive decision

`pickMode()` is the single function in the entire codebase that inspects width/height ratio. It
returns one of three abstract modes (`row | stack | hybrid`) — never a surface name. Everything
downstream (allocation, degradation, placement) operates on "main axis" and "cross axis" in the
abstract; a `row` mode surface with `width=2000` behaves identically, structurally, to a `row` mode
surface with `width=500`, because the algorithm only ever sees ratios and proportions, not absolute
surface identity. This is what the brief's "no `if (surface === 'mobile')`" requirement is actually
testing for, and it's verified by `resolver.test.ts`'s
`"produces meaningfully different compositions for portrait vs. wide vs. square"` test, which
asserts the three required demo surfaces resolve to three distinct `mode` values.

## Degradation algorithm (implementation detail)

A naive "shrink to floor then reallocate proportionally" loop has a subtle bug: proportional
reallocation among *all* elements re-expands an already-shrunk element back past its floor on the
next pass, causing an infinite shrink-reallocate cycle. The fix implemented here is a **lock**: once
an element is shrunk to its floor (or dropped), it is excluded from all future proportional
reallocation — the remaining main-axis space (after subtracting locked elements' fixed space and
gaps) is what gets redistributed by weight among whatever is still unlocked. This guarantees
monotonic progress (each iteration either locks or drops exactly one more element) and termination.

## Extending the system

Adding a new surface or renderer requires no change to `resolver.ts` — see the two subsections
above. To extend the element type set (e.g. add a `video` role), add the type to `spec.ts`'s
`ElementType` union and a weight/floor entry in `resolver.ts`'s role tables; no renderer needs to
change until it wants to actually draw the new type differently.

## Data flow for a single resolve

```
resolveLayout(spec, surface)
  1. compute content box (surface minus safeArea)
  2. pickMode(contentW, contentH) -> "row" | "stack" | "hybrid"
  3. allocate(): weighted share of main axis per element, honoring locks
  4. degrade loop: lock lowest-priority element to floor, or drop it, until it fits
  5. hard-constraint pass: floor CTA to minTapTarget (re-running the degrade loop if that
     reclaims space from others), floor text/button font size to minTextSize
  6. placement pass: convert final main-axis sizes into concrete x/y/width/height per
     composition mode
  → ResolvedLayout { mode, elements[], trace[] }
```
