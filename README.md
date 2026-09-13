# Adaptive Layout Engine

This is a TypeScript + React project that implements a constraint-based layout engine for advertisements. It takes a single declarative ad specification and resolves it dynamically to fit whatever physical surface it is asked to render on.

Instead of relying on CSS media queries or writing hardcoded layout branches for every possible screen size, this engine uses a priority-ordered algorithm. It calculates the available space, allocates it based on the semantic role of each element, and gracefully degrades by shrinking or dropping low-priority items when space runs tight. 

This approach means the exact same ad specification can be resolved for a mobile portrait screen, a broadcast lower-third, a square retail kiosk, or an entirely custom, unexpected surface geometry without writing any surface-specific layout code.

## Demo

**[https://adaptive-layout-murex.vercel.app/](https://adaptive-layout-murex.vercel.app/)**

In the demo, you can:
- Switch between different surfaces (mobile, broadcast, kiosk, custom).
- See the layout automatically re-compose and adapt.
- Inspect the resolution trace to see the algorithm's decisions in real time.
- Toggle between DOM and Canvas renderers to prove the layout logic is decoupled from the UI.
- Use the Custom Surface builder to throw arbitrary, extreme constraints at the engine.

## What it demonstrates

- Declarative ad specifications
- Constraint-driven layout and geometry resolution
- Priority-based graceful degradation
- Safe-area inset handling
- Minimum tap-target and minimum text-size enforcement
- Real text measurement and dynamic truncation
- Multiple interactive element support and multiple hero-image distribution
- Typed resolved layouts
- Independent DOM and Canvas rendering
- Runtime surface validation
- Automated layout correctness tests

## Quick start

```bash
npm install
npm run dev
```

To run the test suite, build the project, or check formatting:
```bash
npm test         # Runs vitest layout correctness tests
npm run build    # Compiles TypeScript and builds the Vite production bundle
npm run lint     # Runs ESLint checks
```

## How it works

The core pipeline separates intent from rendering:

Ad Spec + Surface Profile ↓ Constraint Resolver ↓ Resolved Layout ↓ DOM / Canvas Renderer

### 1. Ad spec
The spec describes the content of the ad and the semantic importance (role and priority) of each element. It does not contain pixel positions, CSS classes, or any surface-specific layout rules.

```typescript
const ad = defineAd({
  id: "example",
  elements: [
    {
      id: "headline",
      type: "text",
      role: "primary",
      priority: 1,
      content: "Focus on what matters.",
    },
    {
      id: "cta",
      type: "button",
      role: "action",
      priority: 1,
      content: "Pre-order",
    },
  ],
});
```

### 2. Surface profile
A surface describes the hard physical constraints of the environment rather than defining a particular layout. 

```typescript
const surface = {
  width: 320,
  height: 480,
  safeArea: { top: 16, right: 12, bottom: 16, left: 12 },
  minTapTarget: 44,
  minTextSize: 12,
  touchOnly: true,
};
```

### 3. Resolver
The algorithm inside `resolver.ts` acts as a pure function. Its steps are:
1. Calculate the usable content area by subtracting the safe area.
2. Determine a composition mode (stack, row, or hybrid) based purely on the content aspect ratio.
3. Allocate space to elements using role-based weights.
4. Lock elements that reach their minimum allowable size.
5. Reallocate remaining space among unlocked elements.
6. Shrink lower-priority elements to their minimums if they don't fit naturally.
7. Drop lower-priority elements entirely if their minimum size still cannot fit.
8. Measure text and enforce truncation if text overflows the allocated box.
9. Enforce hard constraints (like ensuring the CTA meets the `minTapTarget`), forcing further degradation of lower-priority items if necessary to make room.
10. Convert the final allocations into concrete x/y/width/height values.

For example, on a large surface, all elements remain visible. As the surface gets smaller, branding shrinks. If space gets very tight, branding drops entirely. On a severely cramped surface, secondary text drops next, while the headline and CTA are protected and remain visible as long as physically possible.

## Composition modes

The resolver supports three composition modes:
- **Stack**: Elements flow vertically (chosen for tall aspect ratios).
- **Row**: Elements flow horizontally (chosen for wide aspect ratios).
- **Hybrid**: Hero images occupy a top horizontal band, while the rest of the content flows in a row beneath (chosen for square-ish aspect ratios).

Importantly, the mode is chosen based on the mathematical aspect ratio of the available content area, not by hardcoding rules like `if (surface === "mobile")`. 

## Priority and degradation

When space runs out, it's better to gracefully remove low-priority elements than to let the UI overlap, clip, or look broken. The resolver uses this priority system:

| Role      | Typical Priority | Behavior                                      |
| --------- | ---------------- | --------------------------------------------- |
| Hero      | 1                | Keeps visual prominence, splits space if many |
| Primary   | 1                | Protected, truncates text only as last resort |
| Action    | 1                | Protected, strictly enforces min tap target   |
| Secondary | 2                | Can shrink or be truncated/dropped            |
| Branding  | 3                | First candidate for removal                   |

## Constraints

The resolver guarantees several constraints:
- **Safe area**: Content is strictly laid out inside the usable area.
- **Minimum tap target**: On touch surfaces, actionable elements are guaranteed a minimum size (e.g., 44px).
- **Minimum text size**: Text can be floored to a minimum pixel size, overriding the default role sizing.
- **Surface validation**: Invalid dimensions, negative values, and safe-areas that consume the entire surface are rejected at runtime.

## Rendering

The resolver returns a strongly typed `ResolvedLayout`. Neither renderer decides where elements should go—they blindly render the positions, dimensions, and text strings produced by the resolver.

- **DOM renderer** (`src/render-dom.tsx`): Renders standard HTML elements and applies accessibility ARIA attributes.
- **Canvas renderer** (`src/render-canvas.tsx`): Renders directly to a 2D canvas context.

This separation is useful because it allows the layout logic to be tested without a browser UI, proves the math is rendering-agnostic, and allows the same resolved layout to be rendered through different backends (e.g., native mobile wrappers) in the future.

## Project structure

```text
src/
├── App.tsx             # Demo shell, custom surface UI, and inspector
├── demo-spec.ts        # The sample AdSpec used in the demo
├── measure-text.ts     # Off-screen canvas utility for accurate text measurement
├── spec.ts             # Types for the AdSpec (intent)
├── surfaces.ts         # Types and definitions for SurfaceProfiles (constraints)
├── resolver.ts         # The core layout algorithm
├── resolver.test.ts    # Automated correctness tests
├── render-dom.tsx      # DOM consumer of the ResolvedLayout
└── render-canvas.tsx   # Canvas consumer of the ResolvedLayout
```

## Testing

The test suite in `resolver.test.ts` validates the mathematical correctness of the engine. It tests for:
- No overlapping elements.
- No elements clipped outside the safe area.
- Strict adherence to minimum tap targets and minimum text sizes.
- Behavioral differences between stack/row/hybrid modes.
- Proper degradation order on cramped surfaces.
- Extreme aspect ratios (e.g., 2500x200).
- Multiple hero element distribution.
- Runtime validation (ensuring `validateSurface` actually throws on bad inputs).

Geometry tests are critical for a layout engine. They guarantee that the mathematical constraints hold true across infinite surface permutations, rather than relying on manual visual QA.

## Custom / unknown surfaces

A surface is just data. The resolver does not need to know its name or dimensions in advance. 

```typescript
const customSurface = {
  id: "dynamic-runtime-surface",
  width: window.innerWidth,
  height: window.innerHeight,
  safeArea: { top: 20, right: 20, bottom: 20, left: 20 },
  touchOnly: true,
  minTapTarget: 48
};

const layout = resolveLayout(adSpec, customSurface, textProvider);
```

This is an important architectural property: the layout engine is resilient to unknown surfaces introduced at runtime. The Custom Surface Builder in the demo proves this behavior live.

## Design decisions

- **Why TypeScript?** For strongly typing specs, surface definitions, roles, priorities, and resolved layouts, preventing impossible states at compile time.
- **Why a pure resolver?** It keeps the core algorithm independent of React and the DOM, making it blazingly fast and easy to test mathematically.
- **Why priority-based degradation?** Not every piece of an ad has equal importance. When space becomes constrained, preserving the CTA and headline is more valuable than scaling everything down until it becomes illegible.
- **Why DOM and Canvas?** To prove that rendering is independent from layout resolution.

## Limitations

- **Flat element model**: The spec defines a flat list of elements rather than nested groups or complex layout trees.
- **Fixed element types**: Currently limited to text, images, and buttons.
- **Approximate image cropping**: Images currently rely on `object-fit: cover` or canvas equivalents rather than smart focal-point cropping.
- **Animations**: DOM animations rely on CSS transitions; the resolver itself is synchronous and instantaneous.

## AI usage

AI tools were used during development for scaffolding, implementation assistance, and test-writing. The final architecture, constraint algorithm, and code were reviewed manually and are understood by the author.

## Time spent

Approximately 1 day including architecture, resolver implementation, tests, renderers, demo UI, and documentation.

## What I would explain in an interview

- How the resolver determines aspect ratio to decide between stack, row, and hybrid composition modes.
- How remaining space is allocated proportionally based on semantic role weights.
- How priority rankings drive the `while` loop that forces graceful degradation (shrinking or dropping) when space is exhausted.
- How hard constraints (like `minTapTarget`) forcefully lock layout dimensions, taking space back from lower-priority items.
- Why the resolver strictly avoids surface-specific branches (e.g. `if (mobile)`), instead relying purely on mathematics and constraints.
- How the `TextMeasurementProvider` allows a pure TS function to accurately wrap text without touching the actual DOM.
