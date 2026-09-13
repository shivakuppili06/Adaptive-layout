# Adaptive Layout Engine for Multi-Surface Ads

A single declarative ad spec, resolved live into meaningfully different layouts for a tall mobile
interstitial, a wide broadcast lower-third, a square retail kiosk, and a landscape phone — via one
priority-ordered constraint resolver, not per-surface layout branches.

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build -> dist/
npm test          # 23 gap-check tests: no overlap, no clipping, hard constraints, degradation order
```

## Using the demo

Open the app and use the **Surface** panel on the left to switch between:

- Mobile Portrait, Mobile Landscape, Broadcast Lower-Third, Retail Kiosk (square)
- **Retail Kiosk — Cramped**: the intentionally too-small surface that proves priority
  degradation — watch the logo (branding) disappear cleanly while the headline and CTA stay intact.
- **Wildcard 5th surface**: a `SurfaceProfile` defined nowhere in `surfaces.ts`, wired up only in
  `App.tsx`, to demonstrate the resolver needs no prior knowledge of a surface to handle it correctly.

The **Renderer** toggle swaps between the DOM renderer and the Canvas renderer — both consume the
exact same `ResolvedLayout` object with no changes to `resolver.ts`.

The **Resolution trace** panel on the right explains, in plain language, every shrink/drop
decision the resolver made for the currently selected surface — this is what answers "why did this
element end up here" live in an interview.

## Resolution flow

```
Ad Spec (spec.ts) + Surface Profile (surfaces.ts)
        │
        ▼
Constraint Resolver (resolver.ts)   — pure function, no DOM/React
        │
        ▼
Resolved Layout (typed x/y/width/height/fontSize per element)
        │
        ├──▶ DOM Renderer (render-dom.tsx)
        └──▶ Canvas Renderer (render-canvas.tsx)
```

## Layout algorithm, step by step

1. **Compose** — the surface's *content-box aspect ratio* (width/height after subtracting the
   safe area) picks one of three composition modes: `row` (ratio ≥ 2.4, e.g. broadcast lower-third),
   `stack` (ratio ≤ 0.85, e.g. mobile portrait), or `hybrid` (everything in between — an image band
   on top, remaining elements in a row below — e.g. a square kiosk or landscape phone). This is the
   *only* place aspect ratio decides anything; nothing downstream branches on surface identity.
2. **Allocate** — each element gets a share of the main axis proportional to a role-based weight
   table (hero/primary get the most space, branding the least).
3. **Degrade** — if an element's weighted share falls below its role's minimum floor, it is locked
   to that floor and the remaining space is re-shared among what's left, starting with the
   lowest-priority element. If every remaining shrinkable element is already at its floor and it
   still doesn't fit, the lowest-priority element is dropped entirely (`visible: false`) and
   allocation re-runs. The CTA (`role: "action"`) is treated as priority 0 — the very last thing
   ever shrunk, and it is never dropped.
4. **Enforce hard constraints** — `minTapTarget` floors the CTA's size on touch surfaces (reclaiming
   space from lower-priority elements via the same degrade loop if needed); `minTextSize` /
   far-viewing-distance floors font size on all text and button labels.
5. **Place** — final sizes are converted into concrete, non-overlapping x/y boxes using the
   composition mode's placement rule (vertical flow, horizontal flow, or image-band + row).

See `ARCHITECTURE.md` for design rationale and extension points.

## TypeScript design

- `AdElement.role` is a closed union (`"primary" | "hero" | "action" | "secondary" | "branding"`) —
  an invalid role is a compile-time error, not a typo that silently falls through to a default.
- `defineAd()` additionally catches the things TypeScript's structural typing can't (duplicate
  element ids, an image element missing `src`) with a clearly-reported runtime error.
- `SurfaceProfile` is fully typed; `validateSurface()` runtime-checks invariants TypeScript can't
  express (safe area doesn't consume the whole canvas, positive dimensions) — this ensures dynamically
  injected surfaces are handled safely.
- `ResolvedLayout` / `ResolvedElement` are the one typed contract both renderers consume — adding a
  third renderer needs no change to `resolver.ts` or `spec.ts`.
- [x] **No runtime mutation**: Resolution is stateless; state lives in React.
- [x] **No CSS layouts (mostly)**: `render-dom.tsx` only uses CSS for the outermost flex container to align the absolutely positioned elements; it does not use Flexbox/Grid for the actual placement.

### Design Decisions

- **Typography & Theme**: I chose a "Pro Tool" dark theme (similar to modern ad-tech/developer tools like Vercel or Linear) using `#090a0b` for the background and `#111318` for panels. This provides a neutral, high-contrast framing that makes the ad preview pop as the hero element. The typography pairs *Outfit* (for a structured, modern display feel) with *Inter* (for highly legible, data-dense UI panels).
- **Picker Layout**: The surface buttons are grouped structurally (Portrait, Wide, Square) and use simple SVG layout icons to hint at the shape before clicking, reducing cognitive load.
- **Trace Panel**: Reimagined as a clean timeline/log. Degradation events (shrunk, dropped, floored) have distinct color treatments and icons, ensuring the "why did this end up here" question is answerable at a glance.
- **Animations**: By keeping dropped elements in the DOM with `opacity: 0` and applying `transition: all 400ms cubic-bezier`, layout reflows and element degradation are fluidly animated without heavy external libraries.

## Known limitations

- **No generic nesting**: `AdSpec` is a flat list of elements, not a DOM tree.
- **No Accessibility (ARIA) pass**: Focus rings and ARIA roles were skipped to focus on ensuring structural layout correctness, though tap targets and contrast are strictly enforced.
- No animated transition *between* resolved layouts of different shapes — the surface-switch
  fade/scale is a simple CSS transition, not a morph between two different composition modes.
- Fixed element type set (`text | image | button`) — no video, carousel, or rich-text elements.
- The `hybrid` mode always treats the single `role: "hero"` element as the top band; a spec with
  two hero-role elements would need the placement logic extended.
- Kiosk/broadcast crop ratios for hero images are approximate (`objectFit: cover`), not driven by a
  declared focal point.

## AI tool disclosure

Built with Claude (Anthropic) as a pair-programming assistant for scaffolding, the resolver
algorithm, and test-writing. All architecture decisions, the degradation algorithm's design, and
final code were reviewed and can be explained line-by-line.

## Time spent

~1 day (architecture + resolver algorithm + tests + two renderers + demo UI + docs).
