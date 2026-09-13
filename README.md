# Adaptive Layout Engine

A pure TypeScript constraint-based layout engine that dynamically resolves ad specifications for different surface sizes without relying on CSS media queries or DOM layout models. 

## How it works

The architecture explicitly separates intent, constraints, and rendering:

- `spec.ts` defines **intent** (what the ad contains, priority of elements).
- `surfaces.ts` defines **constraints** (dimensions, safe areas, min tap targets).
- `resolver.ts` is the **core engine**. It takes a spec and a surface, computes the optimal composition (stack, row, or hybrid), allocates space proportionally by semantic role, and aggressively degrades (shrinks or drops) lower-priority elements when space runs out.
- `render-dom.tsx` and `render-canvas.tsx` are **agnostic consumers**. They contain zero layout logic and merely paint the coordinates emitted by the resolver.

## Features

### Constraint Resolution & Priority Degradation
Elements are assigned strict weights and minimums based on their semantic roles (e.g. `hero`, `primary`, `action`). When surface constraints tighten, the lowest-priority elements (e.g., `branding`) are shrunk or dropped entirely to preserve critical elements (e.g., the CTA `action` button).

### Text Measurement Integration
The resolver is DOM-agnostic but supports passing a `TextMeasurementProvider`. During resolution, text bounds are measured offscreen to accurately compute wrapping and truncation, guaranteeing that text never overflows its resolved layout box.

### Accessibility Constraints (a11y)
Accessibility is treated as a physical constraint:
- `minTapTarget`: Enforced rigorously on touch surfaces. The resolver guarantees actionable elements receive adequate physical space, clawing back space from other elements to achieve it.
- **Semantic DOM**: The `render-dom` package outputs proper ARIA roles, `alt` text, and contrast-aware colors derived directly from the ad spec's intent.

### Custom / Unknown Surfaces
The resolver handles arbitrary, unexpected geometries natively. You can test this using the "Custom Surface Builder" in the demo, injecting wildly cramped or massive surfaces to watch the constraints bend dynamically.

## Setup

```bash
npm install
npm run dev
```

Run tests with `npm test`, or build for production with `npm run build`.

## Architecture Diagram

```text
                 Ad Spec
                    +
              Surface Profile
                    |
                    v
             Validation Layer
                    |
                    v
          Constraint Resolver  <--- (Optional TextMeasurementProvider)
                    |
          +---------+---------+
          |                   |
          v                   v
   Resolved Layout      Constraint Trace
          |                   |
     +----+----+           Inspector UI
     |         |
     v         v
    DOM      Canvas
 Renderer   Renderer
```
