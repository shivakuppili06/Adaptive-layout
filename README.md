# Adaptive Layout Engine

This project started from a simple problem: the same advertisement needs to work on surfaces with drastically different dimensions and physical constraints. Instead of creating a separate CSS media-query layout for every device, I wanted the layout to be dynamically resolved from a single declarative content specification and a description of the target surface.

The engine uses a deterministic, priority-ordered algorithm to calculate the best possible layout. It allocates space proportionally, enforces hard physical constraints (like safe areas and tap targets), and gracefully degrades (shrinks or drops) lower-priority elements when space runs out.

## Live Demo

**[https://adaptive-layout-murex.vercel.app/](https://adaptive-layout-murex.vercel.app/)**

In the demo, you can:
- Switch between completely different surfaces (mobile portrait, broadcast lower-third, cramped kiosk).
- See the layout calculate and recompose dynamically.
- Inspect the Resolution Trace panel to see exactly why the algorithm made each decision.
- Toggle between DOM and Canvas rendering to prove the layout logic is decoupled from the UI.
- Use the Custom Surface builder to inject arbitrary constraints on the fly.

## What it does

The engine separates intent from environment. It proves that you can build a flexible, responsive layout system mathematically, rather than relying on browser layout engines. It supports:
- Declarative ad specifications
- Constraint-driven geometry resolution
- Priority-based degradation (protecting CTAs while dropping logos)
- Safe-area inset handling
- Minimum tap-target constraints for touch surfaces
- Typed resolved layouts decoupled from rendering

## Quick Start

```bash
npm install
npm run dev
```

To verify the project:
```bash
npm test         # Runs vitest correctness tests
npm run build    # Compiles TypeScript and builds the Vite production bundle
npm run lint     # Runs ESLint checks
```

## How it works

The core pipeline is strictly separated:

**Ad Spec** + **Surface Profile** → **Resolver** → **Resolved Layout** → **DOM / Canvas Renderer**

The spec describes the content and semantic importance of each element, independent of pixels:
```typescript
const ad = defineAd({
  id: "example",
  elements: [
    { id: "headline", type: "text", role: "primary", priority: 1, content: "Focus on what matters." },
    { id: "cta", type: "button", role: "action", priority: 1, content: "Pre-order" },
  ],
});
```

A surface describes the physical constraints of the environment, not a layout layout branch:
```typescript
const surface = {
  width: 320,
  height: 480,
  safeArea: { top: 16, right: 12, bottom: 16, left: 12 },
  minTapTarget: 44,
  touchOnly: true,
};
```

## Resolution algorithm

The algorithm inside `resolver.ts` acts as a pure function without any UI dependencies:
1. **Calculate usable area:** Subtracts the safe area from total dimensions.
2. **Select composition mode:** Chooses Stack, Row, or Hybrid purely based on the mathematical aspect ratio of the usable area.
3. **Allocate space:** Distributes available main-axis space using role-based proportional weights.
4. **Check minimum floors:** Locks elements that reach their defined minimum sizes.
5. **Shrink lower-priority elements:** If space is tight, lowest-priority items (e.g. branding) are forced to their minimums.
6. **Drop elements:** If minimum sizes still exceed available space, elements are dropped entirely, starting with the lowest priority.
7. **Measure text:** Uses a provided text measurement abstraction to wrap or truncate text that overflows its resolved box.
8. **Enforce hard constraints:** Guarantees action elements meet `minTapTarget` by forcing further degradation of lower-priority items to make room.
9. **Generate final coordinates:** Converts the abstract allocations into concrete x/y/width/height values.

## Priority and degradation

Not every piece of an ad has equal importance. When space is constrained, the system gracefully degrades rather than allowing content to overlap or overflow.

| Role      | Typical Priority | Behavior                                      |
| --------- | ---------------- | --------------------------------------------- |
| Hero      | 1                | Keeps visual prominence                       |
| Primary   | 1                | Protected, truncates text only as last resort |
| Action    | 1                | Protected, strictly enforces min tap target   |
| Secondary | 2                | Can shrink or be truncated/dropped            |
| Branding  | 3                | First candidate for removal                   |

On a cramped surface, branding drops first. If things get worse, secondary content degrades. The CTA and headline are protected as long as physically possible.

## Surface profiles

Adding a new surface never requires writing a new layout branch.

| Surface | Characteristics |
|---------|-----------------|
| Mobile Portrait | Tall aspect ratio, touch targets enforced |
| Mobile Landscape | Wide aspect ratio, touch targets enforced |
| Broadcast Lower-Third | Ultra-wide, enforces large `minTextSize` |
| Retail Kiosk | Square aspect ratio (hybrid composition) |
| Cramped Kiosk | Intentionally constrained to demonstrate priority degradation |
| Custom/Wildcard | Arbitrary data passed at runtime |

## Rendering

The resolver returns a typed `ResolvedLayout`. The renderers consume that output blindly. 

Neither the **DOM renderer** (`src/render-dom.tsx`) nor the **Canvas renderer** (`src/render-canvas.tsx`) decide where elements should go. They simply paint the coordinates produced by the resolver.

This separation is useful because another renderer (e.g., a native mobile view) can be added later, layout logic can be unit-tested instantly without a browser, and the same exact layout math drives every backend.

## TypeScript design

The project relies heavily on strong typing:
- `AdElement` enforces roles and priorities.
- `SurfaceProfile` defines the strict constraint schema.
- `ResolvedElement` guarantees that the renderer receives fully computed, deterministic coordinates.
The resolver is kept 100% independent from React. The only dependency injection is an optional `TextMeasurementProvider` interface for accurate text wrapping.

## Project structure

```text
src/
├── App.tsx             # Demo UI, surface picker, and inspector trace panel
├── demo-spec.ts        # The sample AdSpec used in the demo
├── measure-text.ts     # Off-screen canvas utility for text measurement
├── spec.ts             # Intent definitions (roles, priorities)
├── surfaces.ts         # Constraint definitions (dimensions, safe areas)
├── resolver.ts         # The core layout algorithm
├── resolver.test.ts    # Automated correctness and geometry tests
├── render-dom.tsx      # DOM renderer implementation
└── render-canvas.tsx   # Canvas renderer implementation
```

## Testing

The test suite in `resolver.test.ts` validates the mathematical correctness of the engine, ensuring:
- No visible elements overlap.
- No elements are clipped outside the surface bounds.
- Minimum tap targets and minimum text sizes are strictly respected.
- Cramped surfaces correctly drop branding before primary content.
- Extreme aspect ratios (e.g. 2500x200) resolve cleanly.
- Runtime validation rejects impossible surfaces (like safe areas that consume the entire canvas).

Testing geometric constraints ensures the math holds true across infinite surface permutations.

## Design decisions

- **Why TypeScript?** For strongly typed specs and constraint schemas, catching impossible layout states at compile time.
- **Why a pure resolver?** It keeps the core algorithm independent of React, making it blazingly fast and easy to test mathematically.
- **Why priority-based degradation?** When space is constrained, preserving the CTA and headline is vastly more valuable than blindly scaling everything down until it becomes illegible.
- **Why DOM and Canvas?** To prove that rendering is completely independent from layout resolution.

## Limitations

- **Flat element model:** The spec defines a flat list of elements rather than nested groups or complex layout trees.
- **Text measurement:** Text wrapping is accurate, but heavily relies on standard system fonts. Advanced typographical features (kerning, custom baselines) are approximate.
- **Image cropping:** Images rely on basic `object-fit: cover` logic rather than smart focal-point cropping.
- **Accessibility:** Basic ARIA roles and contrast checks are implemented, but a full WCAG compliance matrix is outside the scope of the core resolver.

## AI usage

AI tools were used during development for scaffolding, debugging, code review, and documentation formatting. The architecture and implementation were reviewed and adjusted manually against the assignment requirements to ensure the core algorithms behave exactly as designed.

## Time spent

Approximately 1 day including architecture design, resolver implementation, test writing, rendering backends, and demo UI polish.

## What I would improve next

- Allow individual elements to override the surface's default gaps or padding.
- Support nested layout groups in the AdSpec for more complex sub-component arrangements.
- Support aspect-ratio weighted distribution when multiple hero elements are present.
