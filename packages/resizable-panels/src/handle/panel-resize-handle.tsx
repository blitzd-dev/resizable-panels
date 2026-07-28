// biome-ignore-all lint/a11y/useSemanticElements: the WAI-ARIA window-splitter pattern requires a focusable, draggable separator; <hr> cannot provide that interaction.
"use client";

import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { POINTER_CLICK_DRAG_THRESHOLD_PX } from "../core/timing.js";
import {
  type HandleInteractionState,
  type PanelResizeSession,
  usePanelGroup,
} from "../group/group-context.js";
import { usePanelLayoutInternal } from "../provider/contexts.js";
import { readAxisScale } from "../shared/axis-scale.js";
import { resizeCursor, resizeLimitCursor } from "../shared/cursor.js";
import {
  IS_DEVELOPMENT,
  NO_WARNINGS,
  useDevWarnings,
} from "../shared/diagnostics.js";
import { composeRefs } from "../shared/refs.js";
import { useResizeSession } from "./use-resize-session.js";

// Consumer interaction handlers are accepted and composed with the library
// behavior (§5): cancellable start/discrete events (pointer down, keys,
// double-click) run the consumer first and honor preventDefault(); required
// active/terminal events (move, up, cancel, lost capture) always run the
// internal handling and rethrow consumer exceptions only after cleanup.
// `role` and `tabIndex` remain library-owned accessibility invariants.
export type PanelResizeHandleProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "role" | "tabIndex"
> & {
  /** Stable identity inside the immediate group, reported as `handleId` in
   * resize lifecycle events and layout-change metadata. Anonymous handles
   * stay fully functional but report no handleId; the native `id` prop
   * controls only the rendered DOM id. */
  handleId?: string;
  disabled?: boolean;
  /** Pixel movement for each arrow-key press. */
  keyboardStep?: number;
  /** Pixel movement while Alt/Option is held. Defaults to 1. */
  keyboardStepFine?: number;
  /** Pixel movement while Shift is held. Defaults to 50. */
  keyboardStepCoarse?: number;
  /** Pointer hit-area margin on each side of the visible separator. */
  hitAreaMargins?: { coarse?: number; fine?: number };
  /**
   * Width (horizontal groups) or height (vertical groups) in pixels that
   * this handle occupies as real layout space — a visible gutter between
   * its panels, rather than the default zero-width overlay seam. The group
   * reserves the space before distributing its container, so panels plus
   * gutters always sum to the container.
   *
   * With a gutter, the handle element itself spans exactly the gutter —
   * `className`/`style` fill and style the gutter background — and an
   * internal child extends the pointer hit area by `hitAreaMargins` on each
   * side. The default separator line renders centered in the gutter.
   * Percentage-based panel sizes keep resolving against the group's full
   * content box (like CSS), not the gutter-reduced remainder.
   *
   * Defaults to 0 (overlay handle). Invalid values (negative or
   * non-finite) fall back to 0 with a dev warning.
   */
  gutterSize?: number;
  /** Reset the panel on this side to its defaults when the handle is double
   * clicked. Defaults to `"before"`; set false to disable. */
  doubleClickReset?: "before" | "after" | false;
};

type LocalResizeSession = {
  owner: object;
  groupSession: PanelResizeSession | null;
  startPosition: number;
  armed: boolean;
  /** Visual px per layout px along the drag axis at session start. Pointer
   * coordinates arrive in visual px while `moveResize` speaks layout px —
   * inside a `transform: scale()` ancestor the two differ, and feeding
   * screen deltas straight in makes the seam trail the pointer. Deltas
   * divide by this so the seam tracks the cursor 1:1. */
  axisScale: number;
};

/** Explicit separator between two Panels. The surrounding PanelGroup resolves
 * adjacency from committed DOM order, so fragments, conditional panels, and
 * keyed reorders do not require React-child inspection. */
export const PanelResizeHandle = forwardRef<
  HTMLDivElement,
  PanelResizeHandleProps
>(function PanelResizeHandle(
  {
    handleId,
    disabled = false,
    keyboardStep = 10,
    keyboardStepFine = 1,
    keyboardStepCoarse = 50,
    hitAreaMargins,
    gutterSize,
    doubleClickReset = "before",
    id,
    className,
    style,
    onClick: onClickProp,
    onBlur: onBlurProp,
    onFocus: onFocusProp,
    onMouseEnter: onMouseEnterProp,
    onMouseLeave: onMouseLeaveProp,
    // Every composed interaction handler is destructured explicitly so none
    // can silently ride (or vanish through) `...rest` spread ordering (§5).
    onPointerDown: onPointerDownProp,
    onPointerMove: onPointerMoveProp,
    onPointerUp: onPointerUpProp,
    onPointerCancel: onPointerCancelProp,
    onLostPointerCapture: onLostPointerCaptureProp,
    onKeyDown: onKeyDownProp,
    onDoubleClick: onDoubleClickProp,
    ...rest
  },
  elementRef,
) {
  const group = usePanelGroup("<PanelResizeHandle>");
  const layout = usePanelLayoutInternal();
  const tokenRef = useRef<object>({});
  const token = tokenRef.current;
  const slotRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const generatedDomIdSuffix = useHandleId();
  const [registrationVersion, setRegistrationVersion] = useState(0);
  const [hovered, setHovered] = useState(false);
  const movedDuringPointerSession = useRef(false);
  const orientation = group.orientation;
  const axisKey = orientation === "horizontal" ? "clientX" : "clientY";
  const cursor = resizeCursor(orientation);
  const resolvedKeyboardStep =
    Number.isFinite(keyboardStep) && keyboardStep > 0 ? keyboardStep : 10;
  const resolvedFineStep =
    Number.isFinite(keyboardStepFine) && keyboardStepFine > 0
      ? keyboardStepFine
      : 1;
  const resolvedCoarseStep =
    Number.isFinite(keyboardStepCoarse) && keyboardStepCoarse > 0
      ? keyboardStepCoarse
      : 50;
  const coarsePointer = useCoarsePointer();
  const fineMargin = validMargin(hitAreaMargins?.fine, 5);
  const coarseMargin = validMargin(hitAreaMargins?.coarse, 15);
  const hitMargin = coarsePointer ? coarseMargin : fineMargin;
  // Invalid gutter sizes degrade to the overlay-handle default (0), same
  // policy as the other numeric props on this component.
  const resolvedGutterSize = validMargin(gutterSize, 0);
  const hasGutter = resolvedGutterSize > 0;
  const resolvedDoubleClickReset =
    doubleClickReset === false ||
    doubleClickReset === "before" ||
    doubleClickReset === "after"
      ? doubleClickReset
      : "before";

  // Transient interaction facts for the group's line-visibility observer
  // (R-26): hover — the split hit area of a coincident seam already changed
  // the cursor for this half, so the separator line must follow — and
  // VISIBLE (keyboard-modality) focus, which must never be invisible
  // (R-23) and which is also the handle's own lit-focus signal (R-29).
  // Pointer-driven focus deliberately publishes false so post-drag steady
  // state keeps the DOM-order line dedup and the clicked handle rests. The
  // ref mirrors the published entry so the registration effect can
  // republish after an unregister/re-register cycle; interaction handlers
  // are the only other writers — enter/leave/focus/blur cadence, never per
  // pointer move.
  const handleInteractions = group.handleInteractions;
  const interactionRef = useRef<HandleInteractionState>({
    hovered: false,
    focusVisible: false,
  });
  const publishInteraction = useCallback(
    (partial: Partial<HandleInteractionState>) => {
      const next = { ...interactionRef.current, ...partial };
      interactionRef.current = next;
      if (next.hovered || next.focusVisible) {
        handleInteractions.set(token, next);
      } else {
        handleInteractions.delete(token);
      }
    },
    [handleInteractions, token],
  );
  // R-29: the LIT presentation (line opacity, `data-active`, the z-index
  // bump) keys off keyboard-modality focus — the platform `:focus-visible`
  // convention — never raw focus. This local state mirrors the published
  // `focusVisible` bit exactly: `publishFocusVisible` below is the ONE
  // writer for both, called at every modality transition (focus, blur,
  // keydown upgrade, press downgrade), so the handle's own presentation
  // and the group observer's line election can never disagree. Reading the
  // bit back out of `handleInteractions` via a store subscription would
  // work too, but it would notify this handle about a value it just
  // published itself; the mirror keeps the store write-only from here.
  const [focusVisible, setFocusVisible] = useState(false);
  const publishFocusVisible = useCallback(
    (value: boolean) => {
      setFocusVisible(value);
      publishInteraction({ focusVisible: value });
    },
    [publishInteraction],
  );

  // R-27: once a press arms a resize session, `useResizeSession` cancels the
  // pointerdown's default action (that preventDefault must stay — it also
  // stops text-selection anchoring and native drag-start under the seam, and
  // suppresses the touch compatibility mouse events), which swallows the
  // browser's native click-gives-focus. Focus the separator explicitly so
  // the WAI-ARIA window-splitter pointer→keyboard handoff works: drag (or
  // just press) with the mouse, fine-tune with arrows, Tab onward from the
  // seam. Focus persists after release — standard splitter behavior; the
  // whole lit presentation keys off keyboard modality (R-29, extending
  // R-23's treatment), so pointer-acquired focus is visually silent until
  // the first keydown upgrades it.
  //
  // Modality: a press is pointer input by definition, so `focusVisible:
  // false` is published AFTER focusing — `element.focus()` synchronously
  // runs the focus handler below, whose `:focus-visible` sample is
  // engine-dependent for programmatic focus inside a pointer gesture; the
  // trailing publish makes the pointer-modality outcome deterministic. It
  // also downgrades a re-pressed keyboard-focused handle (a fresh press is
  // pointer modality), keeping post-drag line dedup in DOM order exactly as
  // the R-24/R-26 contracts pin. Any subsequent keydown upgrades to visible
  // focus (the R-26 pattern) — which is precisely the click→arrow handoff.
  const focusFromPress = useCallback(() => {
    const element = handleRef.current;
    if (!element) return;
    // ownerDocument-scoped: a handle inside an iframe or portal focuses
    // within its own document; no top-document activeElement assumptions.
    if (element.ownerDocument.activeElement !== element) {
      element.focus({ preventScroll: true });
    }
    publishFocusVisible(false);
  }, [publishFocusVisible]);

  const registerHandle = group.registerHandle;
  useLayoutEffect(() => {
    const unregister = registerHandle(
      token,
      () => handleRef.current,
      handleId,
      resolvedGutterSize,
    );
    // Unregistering dropped the published interaction entry (a handle can
    // unmount mid-hover and never see mouseleave); a re-register replay
    // (StrictMode, handleId/gutter changes) restores it from the mirror so
    // a live hover/focus keeps its line. Idempotent behind the store's
    // equality gate.
    const interaction = interactionRef.current;
    if (interaction.hovered || interaction.focusVisible) {
      handleInteractions.set(token, interaction);
    }
    setRegistrationVersion((version) => version + 1);
    return () => {
      const groupElement = slotRef.current?.parentElement;
      const handle = handleRef.current;
      const handles = groupElement
        ? Array.from(
            groupElement.querySelectorAll<HTMLElement>(
              "[data-resizable-panels-resize-handle]",
            ),
          )
        : [];
      const handleIndex = handle ? handles.indexOf(handle) : -1;
      const restoreFocus = handle !== null && document.activeElement === handle;
      unregister();
      if (restoreFocus && groupElement) {
        queueMicrotask(() => {
          if (!groupElement.isConnected) return;
          const remaining = Array.from(
            groupElement.querySelectorAll<HTMLElement>(
              "[data-resizable-panels-resize-handle]:not([data-disabled])",
            ),
          );
          remaining[
            Math.min(Math.max(0, handleIndex), remaining.length - 1)
          ]?.focus();
        });
      }
    };
  }, [registerHandle, token, handleId, resolvedGutterSize, handleInteractions]);

  const handleState = useSyncExternalStore(
    useCallback(
      (notify: () => void) => group.handleStates.subscribeKey(token, notify),
      [group.handleStates, token],
    ),
    useCallback(
      () => group.handleStates.get(token) ?? null,
      [group.handleStates, token],
    ),
    () => null,
  );
  // Session-ownership presentation (R-22). The white active highlight,
  // `data-limited`, and the z-index bump belong to the handle whose
  // boundary OWNS the live pointer session — at a coincident seam
  // `resolvePointerResizeHandle` can transfer ownership away from the
  // handle holding pointer capture on the first qualifying move. Ownership
  // arrives through a per-key subscription so a session start/tick/end
  // notifies only the owning handle (C8: resize commits stay local, never
  // a group-wide broadcast); the pressed handle needs no notification —
  // it learns it surrendered the session synchronously inside its own
  // move handler (`sessionTransferred` below).
  const pointerSessions = group.handlePointerSessions;
  const subscribePointerSession = useCallback(
    (notify: () => void) => pointerSessions.subscribeKey(token, notify),
    [pointerSessions, token],
  );
  const ownsPointerSession = useSyncExternalStore(
    subscribePointerSession,
    useCallback(
      () => pointerSessions.get(token) !== undefined,
      [pointerSessions, token],
    ),
    () => false,
  );
  const limited = useSyncExternalStore(
    subscribePointerSession,
    useCallback(
      () => pointerSessions.get(token)?.limited === true,
      [pointerSessions, token],
    ),
    () => false,
  );
  // True while this handle's live pointer session belongs to a coincident
  // sibling's boundary: the press captured the pointer here, but the first
  // qualifying move began the group session on the other handle (R-22).
  // Local state — set by this handle's own move, cleared on press/end —
  // so the surrender never needs a cross-handle store notification.
  const [sessionTransferred, setSessionTransferred] = useState(false);
  const lineVisibility = group.handleLineVisibility;
  const subscribeLineState = useCallback(
    (notify: () => void) => lineVisibility.subscribeKey(token, notify),
    [lineVisibility, token],
  );
  const lineVisible = useSyncExternalStore(
    subscribeLineState,
    useCallback(
      () => lineVisibility.get(token)?.visible ?? true,
      [lineVisibility, token],
    ),
    () => true,
  );
  // R-28: a coincident run presents as ONE seam. The group's visibility
  // observer elects one stable line per run (session owner > keyboard
  // focus > DOM order) and flags it `runHot` while ANY run member is
  // hovered — so this handle lights its line even when the pointer is over
  // a sibling's half of the shared hit area and this element is
  // (truthfully) not data-active. Primitive snapshots on a shared per-key
  // subscription: `replaceAll` rebuilds value objects each recompute, and
  // reading bits keeps unchanged recomputes render-inert.
  const lineRunHot = useSyncExternalStore(
    subscribeLineState,
    useCallback(
      () => lineVisibility.get(token)?.runHot === true,
      [lineVisibility, token],
    ),
    () => false,
  );
  const isDisabled = disabled || handleState?.disabled || !handleState;
  // R-18: the boundary cannot drag (an adjacent zero-collapsed collapsible
  // panel), but the handle stays focusable and Enter expands that panel.
  // The consumer `disabled` prop still disables everything.
  const toggleOnly = !disabled && handleState?.toggleOnly === true;
  const handleDiagnostic =
    registrationVersion > 0 ? group.getHandleDiagnostic(token) : null;
  useDevWarnings(
    IS_DEVELOPMENT
      ? [
          handleDiagnostic,
          resolvedKeyboardStep !== keyboardStep
            ? "<PanelResizeHandle keyboardStep> must be a finite number greater than zero. Falling back to 10."
            : null,
          resolvedFineStep !== keyboardStepFine
            ? "<PanelResizeHandle keyboardStepFine> must be a finite number greater than zero. Falling back to 1."
            : null,
          resolvedCoarseStep !== keyboardStepCoarse
            ? "<PanelResizeHandle keyboardStepCoarse> must be a finite number greater than zero. Falling back to 50."
            : null,
          fineMargin !== hitAreaMargins?.fine &&
          hitAreaMargins?.fine !== undefined
            ? "<PanelResizeHandle hitAreaMargins.fine> must be a finite non-negative number. Falling back to 5."
            : null,
          coarseMargin !== hitAreaMargins?.coarse &&
          hitAreaMargins?.coarse !== undefined
            ? "<PanelResizeHandle hitAreaMargins.coarse> must be a finite non-negative number. Falling back to 15."
            : null,
          gutterSize !== undefined && resolvedGutterSize !== gutterSize
            ? "<PanelResizeHandle gutterSize> must be a finite non-negative number. Falling back to 0."
            : null,
          resolvedDoubleClickReset !== doubleClickReset
            ? '<PanelResizeHandle doubleClickReset> must be "before", "after", or false. Falling back to "before".'
            : null,
        ]
      : NO_WARNINGS,
  );

  const session = useResizeSession<LocalResizeSession>({
    cursor: group.cursorBehavior === "none" ? undefined : cursor,
    globalCursor: group.cursorBehavior === "global",
    onStart(event, owner) {
      // Disabled handles arm nothing and must not steal focus (their
      // pointer-events are off anyway, so a press normally never lands
      // here; consumer-dispatched events still take this guard).
      if (isDisabled) return null;
      // Toggle-only handles never arm a pointer session: drag on the
      // zero-collapsed seam stays inert by design (R-18) and must not
      // claim provider-wide interaction state. A press is still a
      // deliberate pointer interaction with the separator, so it takes
      // focus — Enter is discoverable right after the click (pointerdown
      // fires only on a direct press of the seam; a selection sweep that
      // merely crosses the drag-dead seam never reaches this handler, so
      // no focus is stolen mid-sweep).
      if (toggleOnly) {
        focusFromPress();
        return null;
      }
      if (!layout.claimResizeSession(owner, true)) return null;
      // The press armed a session (click-no-move included): take focus
      // now, before the session's preventDefault suppresses the native
      // click-focus default action (R-27).
      focusFromPress();
      // The resize lifecycle brackets actual movement (R-03): every pointer
      // session — normal and coincident alike — arms here and defers
      // `group.beginResize` (and with it `onResizeStart`) until the first
      // move that passes the click-vs-drag threshold. A press-and-release
      // without qualifying movement emits nothing. The provider exclusivity
      // claim, pointer capture, and body cursor/user-select styling remain
      // press-scoped: they are interaction plumbing, not lifecycle.
      movedDuringPointerSession.current = false;
      setSessionTransferred(false);
      return {
        owner,
        groupSession: null,
        startPosition: event[axisKey],
        armed: true,
        // The slot's parent is the group container — the largest element
        // sharing the handle's ancestor transforms.
        axisScale: readAxisScale(slotRef.current?.parentElement, orientation),
      };
    },
    onMove(current, event) {
      const screenDelta = event[axisKey] - current.startPosition;
      // The click-vs-drag threshold only classifies click vs drag: it gates
      // the FIRST qualifying move (arming coincident seams and the
      // compatibility-click suppression keyed off
      // `movedDuringPointerSession`). Once the session has moved, every
      // pointer position must reach `moveResize` — dropping later moves that
      // land back within the threshold of the pointer-down origin would
      // carve a dead zone around the start position, freezing the live
      // collapse/reopen threshold decision exactly when a reversal returns
      // to the seam's origin (R-19; the retired TESTING.md's C3 contract,
      // git history 30c3424: rapid reversal must not produce stuck states —
      // now enforced by collapse-below-rapid-reversal.spec.ts).
      if (
        !movedDuringPointerSession.current &&
        Math.abs(screenDelta) <= POINTER_CLICK_DRAG_THRESHOLD_PX
      ) {
        return;
      }
      movedDuringPointerSession.current = true;
      // The click-vs-drag threshold above stays in visual px (it classifies
      // pointer travel); everything handed to the group converts to layout px.
      const layoutDelta = screenDelta / current.axisScale;
      const delta =
        orientation === "horizontal" && group.getTextDirection() === "rtl"
          ? -layoutDelta
          : layoutDelta;
      if (current.armed) {
        current.armed = false;
        // Resolve the owning boundary now that the pointer's direction is
        // known. Called unconditionally: for a normal (full hit-area) handle
        // `resolvePointerResizeHandle` short-circuits to the handle's own
        // token before any DOM measurement; only coincident split hit-areas
        // trigger the candidate scan.
        const selectedToken = group.resolvePointerResizeHandle(token, delta);
        current.groupSession = group.beginResize(
          selectedToken,
          "pointer",
          current.owner,
        );
        // Ownership went to a coincident sibling's boundary: this handle
        // keeps relaying pointer moves but must stop presenting as active
        // (R-22) — the owner's highlight arrives through its published
        // session entry.
        if (current.groupSession && selectedToken !== token) {
          setSessionTransferred(true);
        }
      }
      if (!current.groupSession) return;
      // The limited result reaches `data-limited` through the group's
      // published session state on the OWNING handle (R-22); this handle
      // only consumes it here for the global body cursor.
      const nextLimited = group.moveResize(current.groupSession, delta);
      if (group.cursorBehavior === "global") {
        // Same document the session saved/restores — a handle inside an
        // iframe must not paint the top document's cursor.
        const body = (handleRef.current?.ownerDocument ?? document).body;
        body.style.cursor = nextLimited
          ? resizeLimitCursor(orientation, screenDelta)
          : cursor;
      }
    },
    onEnd(current, canceled) {
      try {
        if (current.groupSession) {
          group.endResize(current.groupSession, canceled);
        }
      } finally {
        layout.releaseResizeSession(current.owner);
        setSessionTransferred(false);
      }
    },
  });
  // Hover and keyboard-VISIBLE focus make an idle handle discoverable;
  // while any handle is being dragged, those states stay suppressed on its
  // siblings. Focus contributes via the `:focus-visible` modality mirror,
  // not raw focus (R-29): pointer-acquired focus (R-27's focusFromPress)
  // holds the element focused but presents at rest until a keydown
  // upgrades the modality — the same signal the group observer's line
  // election consumes, so lit state and line election always agree. The
  // local pointer session presents active from the press — EXCEPT once
  // its first qualifying move transferred the group session to a
  // coincident sibling's boundary (R-22): then the owning handle glows via
  // its published session entry and the pressed handle stays quiet for the
  // session's lifetime even though it holds pointer capture.
  const active =
    !isDisabled &&
    (ownsPointerSession ||
      (session.active && !sessionTransferred) ||
      ((hovered || focusVisible) && !layout.isDragging));
  // The separator line lights for the element's own active state, and —
  // run-level presentation (R-28) — while the coincident run it fronts is
  // hovered anywhere in the shared hit area. `data-active` stays truthful
  // to the actually-hovered/focused ELEMENT (consumer styling contract);
  // only the library-internal line is run-aware. `runHot` is never set
  // while THIS group has a live session; the `isDragging` gate mirrors the
  // hover suppression above during sibling groups' drags.
  const lineLit = active || (lineRunHot && !layout.isDragging);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (isDisabled) return;
      // Keyboard interaction upgrades pointer-acquired focus to VISIBLE
      // focus — the deterministic mirror of the browser's :focus-visible
      // heuristic (which flips only between events, at engine-specific
      // moments), so a coincident handle's line follows the keyboard user.
      // The upgrade runs for ANY key reaching this handler (resize key or
      // not — a bare modifier press upgrades too, matching the platform
      // convention) and BEFORE the resize dispatch below, so the keystroke
      // that upgrades also lights the handle in the same React commit as
      // the resize it may trigger (R-29): click then ArrowLeft moves the
      // seam AND lights it on that arrow press, never the next one.
      if (!interactionRef.current.focusVisible) {
        publishFocusVisible(true);
      }
      if (event.key === "Enter") {
        if (!group.toggleHandlePanel(token)) return;
        event.preventDefault();
        return;
      }
      const step = event.altKey
        ? resolvedFineStep
        : event.shiftKey
          ? resolvedCoarseStep
          : resolvedKeyboardStep;
      let delta = 0;
      if (event.key === "Home") delta = -Number.MAX_SAFE_INTEGER;
      else if (event.key === "End") delta = Number.MAX_SAFE_INTEGER;
      else if (
        (orientation === "horizontal" && event.key === "ArrowLeft") ||
        (orientation === "vertical" && event.key === "ArrowUp")
      ) {
        delta = -step;
      } else if (
        (orientation === "horizontal" && event.key === "ArrowRight") ||
        (orientation === "vertical" && event.key === "ArrowDown")
      ) {
        delta = step;
      } else {
        return;
      }

      if (
        orientation === "horizontal" &&
        group.getTextDirection() === "rtl" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        delta = -delta;
      }

      event.preventDefault();
      const owner = {};
      if (!layout.claimResizeSession(owner, false)) return;
      try {
        const resize = group.beginResize(token, "keyboard", owner);
        if (!resize) return;
        group.moveResize(resize, delta);
        group.endResize(resize);
        layout.setSkipAnim(true);
      } finally {
        layout.releaseResizeSession(owner);
      }
    },
    [
      orientation,
      group,
      isDisabled,
      resolvedKeyboardStep,
      resolvedFineStep,
      resolvedCoarseStep,
      layout,
      token,
      publishFocusVisible,
    ],
  );

  const onDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (isDisabled || resolvedDoubleClickReset === false) return;
      if (!group.resetHandlePanel(token, resolvedDoubleClickReset, "pointer"))
        return;
      event.preventDefault();
    },
    [group, isDisabled, resolvedDoubleClickReset, token],
  );

  const setElementRef = useMemo(
    () => composeRefs<HTMLDivElement>(handleRef, elementRef),
    [elementRef],
  );

  const isVerticalSeparator = orientation === "horizontal";
  const pointerHitArea = handleState?.pointerHitArea ?? "full";
  // A gutter separates its panels physically, so the coincident-seam
  // geometry that split hit areas disambiguate cannot arise around it (two
  // handle slots are always at least the gutter apart): the whole gutter is
  // one pointer target and the line centers in it, regardless of the
  // published split state.
  const effectiveHitArea = hasGutter ? "full" : pointerHitArea;
  const splitHitArea =
    effectiveHitArea === "before" || effectiveHitArea === "after";
  const restingZIndex = style?.zIndex ?? 20;
  const activeZIndex =
    typeof restingZIndex === "number" ? Math.max(30, restingZIndex + 1) : 30;
  const hitAreaStyle: CSSProperties = {
    position: "absolute",
    outline: "none",
    touchAction: "none",
    pointerEvents:
      isDisabled || effectiveHitArea === "none" ? "none" : undefined,
    cursor:
      isDisabled || toggleOnly
        ? "default"
        : group.cursorBehavior === "none"
          ? undefined
          : cursor,
    // With a gutter the handle element spans exactly the gutter box, so
    // consumer className/style fill the gutter background; the pointer
    // margins live on a transparent child rendered below.
    ...(hasGutter
      ? { inset: 0 }
      : isVerticalSeparator
        ? effectiveHitArea === "before"
          ? {
              top: 0,
              bottom: 0,
              insetInlineEnd: 0,
              width: hitMargin,
            }
          : effectiveHitArea === "after"
            ? {
                top: 0,
                bottom: 0,
                insetInlineStart: 0,
                width: hitMargin,
              }
            : {
                top: 0,
                bottom: 0,
                insetInlineStart: -hitMargin,
                width: hitMargin * 2,
              }
        : effectiveHitArea === "before"
          ? {
              left: 0,
              right: 0,
              top: -hitMargin,
              height: hitMargin,
            }
          : effectiveHitArea === "after"
            ? {
                left: 0,
                right: 0,
                top: 0,
                height: hitMargin,
              }
            : {
                left: 0,
                right: 0,
                top: -hitMargin,
                height: hitMargin * 2,
              }),
    ...style,
    // Active resize feedback must win at intersections between nested group
    // separators. Color alone is insufficient when an inactive handle later
    // in paint order crosses the dragged line.
    zIndex: active ? activeZIndex : restingZIndex,
  };
  // Extends the gutter handle's pointer target by the hit-area margins on
  // each side without letting consumer backgrounds bleed over the panels.
  // Events on it bubble to the handle element's React handlers; cursor
  // inherits, touch-action does not, so it carries its own.
  const gutterHitExtensionStyle: CSSProperties = isVerticalSeparator
    ? {
        position: "absolute",
        top: 0,
        bottom: 0,
        insetInlineStart: -hitMargin,
        insetInlineEnd: -hitMargin,
        touchAction: "none",
      }
    : {
        position: "absolute",
        left: 0,
        right: 0,
        top: -hitMargin,
        bottom: -hitMargin,
        touchAction: "none",
      };
  const lineStyle: CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    background:
      "var(--resizable-panels-resize-handle-color, rgb(120, 120, 120))",
    opacity: lineLit ? 0.6 : 0,
    transition: layout.prefersReducedMotion
      ? "none"
      : "opacity 150ms, background 150ms",
    ...(isVerticalSeparator
      ? {
          top: 0,
          bottom: 0,
          ...(effectiveHitArea === "before"
            ? { insetInlineEnd: 0 }
            : effectiveHitArea === "after"
              ? { insetInlineStart: 0 }
              : { insetInlineStart: "50%" }),
          width: 1,
        }
      : {
          left: 0,
          right: 0,
          top:
            effectiveHitArea === "before" ? "100%" : splitHitArea ? 0 : "50%",
          height: 1,
        }),
  };

  return (
    <div
      ref={slotRef}
      data-resizable-panels-resize-handle-slot=""
      style={{
        position: "relative",
        // A gutter occupies real layout space (R-14); the group's allocator
        // reserves it so panels + gutters sum to the container.
        flex: `0 0 ${resolvedGutterSize}px`,
        alignSelf: "stretch",
      }}
    >
      <div
        {...rest}
        ref={setElementRef}
        id={id ?? `resizable-panels-handle-${generatedDomIdSuffix}`}
        role="separator"
        tabIndex={isDisabled ? -1 : 0}
        aria-disabled={isDisabled || undefined}
        aria-orientation={isVerticalSeparator ? "vertical" : "horizontal"}
        aria-controls={
          handleState
            ? `${handleState.beforeId} ${handleState.afterId}`
            : undefined
        }
        aria-valuemin={handleState?.valueMin}
        aria-valuemax={handleState?.valueMax}
        aria-valuenow={handleState?.valueNow}
        aria-valuetext={handleState?.valueText}
        data-resizable-panels-resize-handle=""
        data-before-panel={handleState?.beforePanelId}
        data-after-panel={handleState?.afterPanelId}
        data-orientation={isVerticalSeparator ? "vertical" : "horizontal"}
        data-active={active ? "" : undefined}
        data-limited={limited ? "" : undefined}
        data-disabled={isDisabled ? "" : undefined}
        data-toggle-only={toggleOnly ? "" : undefined}
        data-adjacent-collapsed={
          handleState?.adjacentCollapsed ? "" : undefined
        }
        data-pointer-hit-area={
          effectiveHitArea === "full" ? undefined : effectiveHitArea
        }
        className={className}
        style={hitAreaStyle}
        onClick={(event) => {
          // Preserve the click contract: an ordinary click reaches the
          // consumer; the compatibility click generated after a drag beyond
          // the movement threshold is suppressed (§5).
          if (movedDuringPointerSession.current) {
            movedDuringPointerSession.current = false;
            event.preventDefault();
            return;
          }
          onClickProp?.(event);
        }}
        onKeyDown={(event) => {
          // Cancellable discrete event: consumer first; preventDefault()
          // (or a consumer exception) stops the library keyboard action.
          onKeyDownProp?.(event);
          if (event.defaultPrevented) return;
          onKeyDown(event);
        }}
        onDoubleClick={(event) => {
          onDoubleClickProp?.(event);
          if (event.defaultPrevented) return;
          onDoubleClick(event);
        }}
        onMouseEnter={(event) => {
          setHovered(true);
          publishInteraction({ hovered: true });
          onMouseEnterProp?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          publishInteraction({ hovered: false });
          onMouseLeaveProp?.(event);
        }}
        onFocus={(event) => {
          publishFocusVisible(matchesFocusVisible(event.currentTarget));
          onFocusProp?.(event);
        }}
        onBlur={(event) => {
          publishFocusVisible(false);
          onBlurProp?.(event);
        }}
        onPointerDown={(event) => {
          // Cancellable start: consumer first; preventDefault() (or a
          // consumer exception) prevents the resize session from starting.
          onPointerDownProp?.(event);
          if (event.defaultPrevented) return;
          session.onPointerDown(event);
        }}
        onPointerMove={(event) => {
          // Required active event: observational for the consumer and
          // non-cancellable once a session is active. A consumer exception
          // is rethrown only after the internal move ran.
          let failure: unknown;
          let failed = false;
          try {
            onPointerMoveProp?.(event);
          } catch (error) {
            failure = error;
            failed = true;
          }
          session.onPointerMove(event);
          if (failed) throw failure;
        }}
        onPointerUp={(event) => {
          // Required terminal events: internal cleanup (capture release,
          // provider ownership, body cursor, user-select) must run exactly
          // once regardless of consumer behavior; consumer exceptions are
          // rethrown only after that cleanup.
          let failure: unknown;
          let failed = false;
          try {
            onPointerUpProp?.(event);
          } catch (error) {
            failure = error;
            failed = true;
          }
          session.onPointerUp(event);
          if (failed) throw failure;
        }}
        onPointerCancel={(event) => {
          let failure: unknown;
          let failed = false;
          try {
            onPointerCancelProp?.(event);
          } catch (error) {
            failure = error;
            failed = true;
          }
          session.onPointerCancel(event);
          if (failed) throw failure;
        }}
        onLostPointerCapture={(event) => {
          let failure: unknown;
          let failed = false;
          try {
            onLostPointerCaptureProp?.(event);
          } catch (error) {
            failure = error;
            failed = true;
          }
          session.onLostPointerCapture(event);
          if (failed) throw failure;
        }}
      >
        {hasGutter ? (
          <div
            data-resizable-panels-resize-handle-hit-area=""
            style={gutterHitExtensionStyle}
          />
        ) : null}
        {lineVisible ? (
          // The line's own data-active is the RUN-AWARE lit state (R-28):
          // unlike the handle element's truthful data-active, it is set
          // whenever the line lights — including when a coincident
          // sibling's half of the shared hit area is the hovered one — so
          // consumers restyling the line (overriding the inline opacity)
          // can key their lit treatment off the line itself.
          <div
            data-resizable-panels-resize-handle-line=""
            data-active={lineLit ? "" : undefined}
            style={lineStyle}
          />
        ) : null}
      </div>
    </div>
  );
});

function useHandleId() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

/** Whether focus arrived with keyboard modality. Sampled inside the focus
 * handler, where every evergreen engine has already settled the
 * `:focus-visible` state for the new focus. Selector engines without the
 * pseudo-class (older jsdom) err toward treating focus as visible — the
 * safe direction for focus indication. */
function matchesFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

function validMargin(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) || value < 0
    ? fallback
    : value;
}

let coarsePointerQuery: MediaQueryList | null = null;

function getCoarsePointerQuery(): MediaQueryList | null {
  if (typeof matchMedia === "undefined") return null;
  coarsePointerQuery ??= matchMedia("(pointer: coarse)");
  return coarsePointerQuery;
}

function subscribeCoarsePointer(notify: () => void): () => void {
  const query = getCoarsePointerQuery();
  if (!query) return () => {};
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

function getCoarsePointer(): boolean {
  return getCoarsePointerQuery()?.matches ?? false;
}

function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointer,
    () => false,
  );
}
