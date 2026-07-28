# Changelog

All notable changes to `@blitzd/resizable-panels` are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Under 0.x, minor versions may carry breaking changes; the stable-contract
intent is enforced by the packed type-contract tests rather than by a 1.0.0
major.

## 0.1.0

Initial public release. Headless, animated, resizable panel layout primitives
for React 18 and 19.

### Added

- `PanelGroup`, `Panel`, `PanelResizeHandle`, and an optional `PanelProvider`
  (a standalone group installs an implicit provider).
- Docked and peer panels with nested groups and per-axis relative sizing.
  Docked panels collapse animated, instantly, or to a `collapsedSize` rail;
  `collapseBelow` thresholds close a panel mid-drag, with hysteresis and a
  configurable close behavior.
- Group-level `animation` control — disable all library-owned transitions, or
  override the default 300ms duration and easing per group.
- Sibling drag cascades with a `cascade` prop choosing mid-drag reversal
  semantics (`"reversible"` retraces the cascade exactly; `"latching"` keeps
  far panels pushed until released space reaches them), plus per-panel
  opt-outs: `disabled` blocks all resizing, `pinned` exempts a docked panel
  from other handles' cascades.
- Per-panel `containerResizeBehavior` (`"fixed"` or `"proportional"`) deciding
  how expanded panels respond when the group's container changes size.
- Group value model (`PanelGroupValue`) with controlled/uncontrolled state and
  `onValueChange` reason/trigger metadata, separate from the pointer resize
  lifecycle (`onResizeStart`/`onResizeEnd`).
- Imperative `apiRef` controllers (`PanelApi`, `PanelGroupApi`) and
  locator-keyed hooks (`usePanelControls`, `usePanelActions`,
  `usePanelRegistry`, `usePanelCollapsed`, `usePanelInteractionState`,
  `usePanelGroupState`).
- Authoritative action results reporting the accepted value.
- Grouped `persistence` option with read/deserialize/write error reporting and
  restore status callbacks.
- Strict, CSS-compatible `SizeSpec` grammar with field-specific fallbacks and
  development diagnostics.
- Keyboard and screen-reader support: handles implement the ARIA separator
  pattern (`aria-valuenow`/`min`/`max`, `aria-controls`, `aria-orientation`)
  and resize with the arrow keys, `Home`, and `End`, at full parity with
  pointer gestures.
- RTL layouts via `dir="rtl"` on the group, touch and pointer input, and
  SSR-safe rendering.
- Zero runtime dependencies; ships as tree-shakeable ESM with CI-enforced
  bundle-size budgets.
