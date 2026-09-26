# CSS Animation Sandbox

A visual CSS keyframe editor and animation laboratory built with Next.js and Tailwind CSS. Design, scrub, fine-tune cubic-bezier curves, inspect 3D perspective transforms, and export production-ready keyframes.

- **Demo:** [https://css-animation-sandbox.vercel.app](https://css-animation-sandbox.vercel.app)
- **Repository:** [https://github.com/mmy-lana/css-animation-sandbox](https://github.com/mmy-lana/css-animation-sandbox)

---

## Features

- **Multi-Track Timeline:** Scrub, seek, and drag keyframe nodes with sub-percent precision. Includes pinned 0% and 100% boundary enforcement and automatic collision displacement.
- **Interactive Cubic-Bezier Visualizer:** Live SVG control polygon with drag handles, bisection curve sampling, and quick presets (`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`).
- **Comprehensive Property Inspector:**
  - **Transform (3D):** `translate3d`, `rotateX/Y/Z`, `scale3d`, and `skewX/Y`.
  - **Filters:** `blur`, `brightness`, `contrast`, `grayscale`, `hue-rotate`, `invert`, `opacity`, and `saturate`.
  - **Paint & Surface:** Background, border width/color, corner radius, box shadow (including inset toggle), and transform-origin coordinates.
- **3D Preview Viewport:** Direct-manipulation translation and rotation gimbal gizmo, customizable stage lighting, floor grid, axes overlay, and motion trails.
- **20 Curated Studio Presets:** Pre-configured animations across four categories (`motion`, `attention`, `material`, and `type`), with non-destructive preview and timeline appending.
- **Multi-Format Export Engine:**
  - Pure Vanilla CSS (`@keyframes` + utility class + optional `-webkit-` prefixes and CSS variables).
  - Tailwind CSS v4 (`@theme` token + `@keyframes` + `@utility` declaration).
  - Web Animations API (WAAPI script output with typed keyframes and timing options).
- **Client Resilience & Accessibility:**
  - Zero-hydration-mismatch architecture with an initial shell gate.
  - Portaled dropdown menus with auto-flip collision boundary detection.
  - Full WCAG 2.1 AA contrast compliance on obsidian surfaces.
  - Multi-tab synchronization and schema-migrated local storage persistence.

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first `@theme` configuration)
- **Icons:** Lucide React
- **Sanitization:** DOMPurify (SVG profile)
- **Package Manager:** pnpm

---

## Project Structure

```
src/
├── app/
│   ├── globals.css              # Obsidian theme tokens, utilities, base styles
│   ├── layout.tsx               # Root layout with hydration suppression boundaries
│   └── page.tsx                 # Main studio workspace and state orchestrator
├── components/
│   ├── exporter/                # CodeViewer, ExportDrawer, OutputConfigBar
│   ├── inspector/               # BezierCurveEditor, TransformControls, FilterControls, StyleControls
│   ├── navigation/              # StudioTopNav, PresetDrawer
│   ├── stage/                   # ViewportStage, TransformGizmo, TargetGeometry, Visualizers3D
│   ├── timeline/                # ScrubBar, TrackRuler, KeyframeNode, Playhead, TimelineHeader
│   └── ui/                      # Button, Slider, NumberInput, Select, Switch, ColorInput, Modal, Tooltip
├── hooks/
│   ├── useAnimationEngine.ts    # Web Animations API driver and virtual fallback clock
│   ├── useHistoryState.ts       # Immutable undo/redo transaction manager
│   ├── useLocalStorageSync.ts   # Debounced local persistence with multi-tab sync
│   └── useTimelineScrubber.ts   # RAF-coalesced playhead scrubbing logic
├── lib/
│   ├── animationClock.ts        # Pure iteration and progress calculations
│   ├── bezier.ts               # Cubic-bezier polynomial solving and SVG path geometry
│   ├── cn.ts                    # Conflict-resolving Tailwind class merging
│   ├── color.ts                 # Hex/RGB/alpha parsing and contrast utilities
│   ├── cssGenerator.ts          # CSS string generation and WAAPI keyframe serialization
│   ├── defaultProject.ts        # Deterministic starter document factory
│   ├── presets.ts               # Curated studio preset collection
│   ├── sanitizer.ts             # SVG markup purification
│   ├── storage.ts               # Versioned storage envelope and schema migrations
│   └── tailwindFormatter.ts     # Tailwind v4 `@theme` and `@utility` exporter
└── types/
    └── sandbox.ts               # Core domain interfaces, limits, and validation rules
```

---

## Getting Started

### Prerequisites

- Node.js (version 20 or higher recommended)
- pnpm (version 9 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mmy-lana/css-animation-sandbox.git
   cd css-animation-sandbox
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Testing

The repository includes a TypeScript-based automated smoke test harness:

```bash
# Type safety check
pnpm run typecheck

# Full smoke suite (core models, color, UI geometry, storage, studio integration)
pnpm run smoke

# Production build validation
pnpm run build
```

---

## License

MIT License. Free for open-source and commercial use.
