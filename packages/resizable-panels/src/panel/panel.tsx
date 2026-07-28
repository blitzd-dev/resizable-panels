"use client";

import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import {
  IS_DEVELOPMENT,
  NO_WARNINGS,
  useDevWarnings,
} from "../shared/diagnostics.js";
import type {
  PanelActions,
  PanelChangeDetails,
  PanelCollapseBelowBehavior,
  PanelContainerResizeBehavior,
  PanelSide,
  SizeSpec,
} from "../types.js";
import { PeerPanel } from "./peer-panel.js";
import { SidePanel } from "./side-panel.js";

/**
 * One unified `<Panel>` shape. With `side` defined, the panel docks to a
 * group edge with its own size, animated collapse, and a handle on the
 * docked edge (today's "side panel" behavior). Without `side`, it's a
 * **peer**: it shares space with adjacent peers, auto-distributes when no
 * `defaultSize` is given, and resizes via seam handles between peers.
 */
type PanelElementProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "className" | "onResize" | "style"
>;

export type PanelSlotProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

export type PanelSlots = {
  /** Props for the clipping and animation viewport. */
  viewport?: PanelSlotProps;
  /** Props for the element that directly owns the panel's children. */
  content?: PanelSlotProps;
};

type PanelBaseProps = PanelElementProps & {
  /** Stable identity inside the immediate group. Keys layout snapshots,
   * persistence, per-panel events, and provider lookup (together with the
   * group's `groupId`). The native `id` prop controls only the rendered DOM
   * `id`; anonymous panels stay fully resizable but absent from keyed state. */
  panelId?: string;
  /** Imperative panel actions and state reads. The normal React `ref` points
   * to the panel's root HTMLDivElement. */
  apiRef?: Ref<PanelApi>;
  /** Customize the panel's internal viewport and content elements. Root
   * props continue to be supplied directly to `<Panel>`. */
  slotProps?: PanelSlots;
  /**
   * Initial size along the group's axis. Accepts a px number or a CSS-ish
   * string: `"100px"`, `"50%"`, `"2rem"`, `"10vw"`, `"calc(50% - 100px)"`.
   * Optional for peers — peers with no `defaultSize` auto-distribute the
   * remaining group space equally among other unsized peers.
   */
  defaultSize?: SizeSpec;
  /** Lower bound on size, in the same units as `defaultSize`. Default `0`
   *  for peers, `200` for docked panels. */
  minSize?: SizeSpec;
  /** Upper bound on size. Default `"100%"` (the panel can't grow larger
   *  than its parent group on its own). */
  maxSize?: SizeSpec;
  /** How this panel responds when the parent group changes size. Defaults to
   * `"fixed"` for docked panels and `"proportional"` for peers. */
  containerResizeBehavior?: PanelContainerResizeBehavior;
  /** Prevent this panel from being resized directly or through an adjacent
   * resize cascade. */
  disabled?: boolean;
  /** Whether the panel can collapse. Defaults to true for docked panels and
   * false for peers. `"auto"` additionally folds the panel to its collapsed
   * rail when its declared `minSize` stops fitting the container, releasing it
   * when space returns (R-37); requires a non-zero `collapsedSize`. */
  collapsible?: boolean | "auto";
  /** Rendered size while collapsed. Defaults to 0. A non-zero size creates
   * a compact, accessible rail rather than hiding the panel entirely. */
  collapsedSize?: SizeSpec;
  /** Keep the adjacent resize handle interactive for a non-zero collapsed
   * rail, so dragging outward expands it. Defaults to false. */
  resizableWhenCollapsed?: boolean;
  /** Pointer-gesture threshold below which the panel collapses. The rendered
   * panel remains at minSize while the pointer pushes through this range. */
  collapseBelow?: SizeSpec;
  /** Additional neutral distance for reversing a live collapse. Reopening
   * always requires reaching at least minSize; a drag that begins collapsed
   * unlocks at minSize. Defaults to 12px. */
  collapseBelowHysteresis?: SizeSpec;
  /** How the panel closes when `collapseBelow` is crossed. Defaults to
   * `"animated"`; use `"instant"` for a hard snap. */
  collapseBelowBehavior?: PanelCollapseBelowBehavior;
  /** Fires for committed semantic preferred-size changes (in pixels), not
   * incidental renders or animation frames. Mount-suppressed. */
  onSizeChange?: (size: number, details: PanelChangeDetails) => void;
  /** Fires when the committed collapsed state changes, in either direction.
   * Mount-suppressed; the details identify the operation and input.
   *
   * With a controlled `collapsed` prop this becomes the PROPOSAL channel:
   * it fires once per change attempt with the proposed value, and the
   * parent's acceptance re-render is not a change event (it never
   * double-fires). See the `collapsed` prop for the full contract. */
  onCollapsedChange?: (collapsed: boolean, details: PanelChangeDetails) => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

type ControlledPanelCollapsedProps = {
  /**
   * Controlled collapsed state (R-33). When provided on a collapsible
   * panel, the prop is authoritative — the panel renders whatever the
   * parent passes, and every path that would change collapsed state
   * (imperative `setCollapsed`/`collapse`/`expand`/`toggle`/`reset`,
   * `maximize`'s expand half, group `setValue`/`resetValue`/dispatcher
   * commands, Enter on a resize handle, and a drag past `collapseBelow`)
   * EMITS a proposal through `onCollapsedChange(proposed, details)` instead
   * of applying it. The parent accepts by re-rendering with the new value;
   * ignoring the proposal declines it. Accepted-shaped action results
   * report `applied: true`, which here means "proposed" (see
   * `PanelActionResult`); proposing the current prop value reports
   * `unchanged` and emits nothing.
   *
   * Pointer specifics: a drag past `collapseBelow` PRESENTS the threshold
   * motion live while proposing at the crossing (`reason:
   * "collapse"/"expand"`, `trigger: "pointer"`); if the prop has not
   * changed by session end the panel snaps back to the prop state, exactly
   * like a declined controlled-group proposal.
   *
   * Precedence rules:
   * - Mutually exclusive with `defaultCollapsed` (choose controlled or
   *   uncontrolled state, mirroring the group's `value`/`defaultValue`).
   * - Combined with a group-level controlled `value`, the PANEL prop wins
   *   for this panel's collapsed bit (dev-warned misconfiguration; group
   *   value applications propose rather than fight the prop).
   * - Persistence restores SKIP the collapsed field for a controlled panel
   *   (size still restores); write-back records the effective prop value.
   *
   * All readouts (`usePanelControls().collapsed`, `usePanelCollapsed`,
   * `PanelApi.isCollapsed()`, group `getValue()` and emitted group values)
   * report the EFFECTIVE (prop) state. Requires `collapsible`; the prop is
   * inert (dev-warned) on a non-collapsible panel. Keep the panel
   * controlled for its lifetime — switching modes mid-life is not
   * supported, matching React inputs and the group's `value`.
   */
  collapsed: boolean;
  defaultCollapsed?: never;
};

type UncontrolledPanelCollapsedProps = {
  collapsed?: never;
  /** Initial collapsed state. Ignored when `collapsible` is false. */
  defaultCollapsed?: boolean;
};

/** Controlled/uncontrolled collapsed state (R-33) — a two-arm union like
 * the group's `value`/`defaultValue`, kept separate from `PanelBaseProps`
 * so the docked/peer discrimination stays readable. */
type PanelCollapsedStateProps =
  | ControlledPanelCollapsedProps
  | UncontrolledPanelCollapsedProps;

export type DockedPanelProps = PanelBaseProps &
  PanelCollapsedStateProps & {
    /** Dock the panel to this logical group edge with collapse animation. */
    side: PanelSide;
    /** Docked panels require an explicit initial size. */
    defaultSize: SizeSpec;
    /** Exclude this panel from sibling resize cascades. */
    pinned?: boolean;
  };

export type PeerPanelProps = PanelBaseProps &
  PanelCollapsedStateProps & {
    side?: never;
    pinned?: never;
  };

export type PanelProps = DockedPanelProps | PeerPanelProps;

/** Imperative controller attached through `apiRef`. Bound actions plus
 * non-reactive state getters — an imperative channel cannot subscribe, so
 * reads are methods that report current values. */
export type PanelApi = PanelActions & {
  isCollapsed: () => boolean;
  /** Current preferred size in pixels. */
  getSize: () => number;
  /** Currently rendered size in pixels. */
  getRenderedSize: () => number;
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  function Panel(props, elementRef) {
    const runtimeProps = props as PanelBaseProps & {
      side?: PanelSide;
      pinned?: boolean;
      collapsed?: boolean;
      defaultCollapsed?: boolean;
    };
    useDevWarnings(
      IS_DEVELOPMENT
        ? [
            runtimeProps.panelId !== undefined &&
            runtimeProps.panelId.trim() === ""
              ? "<Panel panelId> must be a non-empty string. Omit panelId for an anonymous panel."
              : null,
            runtimeProps.side && runtimeProps.defaultSize === undefined
              ? "A docked <Panel side> requires defaultSize."
              : null,
            !runtimeProps.side && runtimeProps.pinned !== undefined
              ? "Peer <Panel> components cannot use pinned; that prop only applies to docked panels with side."
              : null,
            // Runtime backup for the type-level exclusion (untyped code):
            // mirrors the group's value/defaultValue diagnostic (R-33).
            runtimeProps.collapsed !== undefined &&
            runtimeProps.defaultCollapsed !== undefined
              ? "<Panel> cannot receive both collapsed and defaultCollapsed. Choose controlled or uncontrolled collapsed state."
              : null,
            runtimeProps.collapsible === false &&
            (runtimeProps.defaultCollapsed ||
              runtimeProps.collapsedSize !== undefined ||
              runtimeProps.resizableWhenCollapsed ||
              runtimeProps.collapseBelow !== undefined ||
              runtimeProps.collapseBelowHysteresis !== undefined ||
              runtimeProps.collapseBelowBehavior !== undefined)
              ? "A non-collapsible <Panel> cannot use defaultCollapsed, collapsedSize, resizableWhenCollapsed, collapseBelow, collapseBelowHysteresis, or collapseBelowBehavior."
              : null,
            runtimeProps.containerResizeBehavior !== undefined &&
            runtimeProps.containerResizeBehavior !== "fixed" &&
            runtimeProps.containerResizeBehavior !== "proportional"
              ? '<Panel containerResizeBehavior> must be "fixed" or "proportional".'
              : null,
            runtimeProps.collapseBelowBehavior !== undefined &&
            runtimeProps.collapseBelowBehavior !== "animated" &&
            runtimeProps.collapseBelowBehavior !== "instant"
              ? '<Panel collapseBelowBehavior> must be "animated" or "instant".'
              : null,
            runtimeProps.collapseBelowBehavior !== undefined &&
            runtimeProps.collapseBelow === undefined
              ? "<Panel collapseBelowBehavior> has no effect without collapseBelow."
              : null,
          ]
        : NO_WARNINGS,
    );
    if (props.side) {
      return <SidePanel {...props} elementRef={elementRef} />;
    }
    return <PeerPanel {...props} elementRef={elementRef} />;
  },
);
