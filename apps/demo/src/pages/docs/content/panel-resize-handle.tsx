import DoubleClickReset from "../examples/panel-resize-handle/double-click-reset";
import doubleClickResetSource from "../examples/panel-resize-handle/double-click-reset.tsx?raw";
import GutterHandle from "../examples/panel-resize-handle/gutter-handle";
import gutterHandleSource from "../examples/panel-resize-handle/gutter-handle.tsx?raw";
import HandlePlacement from "../examples/panel-resize-handle/handle-placement";
import handlePlacementSource from "../examples/panel-resize-handle/handle-placement.tsx?raw";
import HitAreaAndDisabled from "../examples/panel-resize-handle/hit-area-and-disabled";
import hitAreaAndDisabledSource from "../examples/panel-resize-handle/hit-area-and-disabled.tsx?raw";
import {
  Callout,
  Code,
  DocLink,
  Example,
  H2,
  Kbd,
  P,
  Pre,
  Related,
  Table,
} from "../primitives";

export function PanelResizeHandleDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        <Code>PanelResizeHandle</Code> is the draggable seam between two panels.
        Place one directly between two <Code>Panel</Code>s and it becomes the
        thing the user grabs to redistribute space along the group&rsquo;s axis.
      </P>

      <Example
        title="Direct-sibling placement"
        caption="A handle resizes the two panels it sits directly between; wrapping it in a div breaks adjacency and disables the seam."
        whatToTry={[
          "Drag the seam to resize",
          "Switch to wrapped — it goes dead",
          "Check the console for the warning",
        ]}
        source={handlePlacementSource}
      >
        <HandlePlacement />
      </Example>

      <H2 id="props">Props</H2>
      <P>
        Every prop <Code>PanelResizeHandle</Code> accepts. The full type is{" "}
        <Code>PanelResizeHandleProps</Code>. The component forwards a ref to its
        root <Code>div</Code> and accepts every native <Code>div</Code>{" "}
        attribute except <Code>role</Code> and <Code>tabIndex</Code>, which it
        owns.
      </P>
      <Table
        rows={[
          [
            "handleId",
            <Code>string</Code>,
            <>
              Group-local identity, reported as <Code>handleId</Code> in resize
              lifecycle events and value-change metadata — set it when a handler
              needs to know which seam moved. Anonymous handles work but report
              no id. The native <Code>id</Code> prop controls only the rendered
              DOM id.
            </>,
          ],
          [
            "disabled",
            <Code>boolean</Code>,
            <>
              Default <Code>false</Code>. Freeze this one seam: it still renders
              (so the layout does not shift) but cannot be dragged, focused, or
              double-clicked. Use{" "}
              <DocLink to="/docs/panel-group">
                <Code>PanelGroup</Code>
              </DocLink>
              &rsquo;s <Code>disabled</Code> to lock every handle at once.
            </>,
          ],
          [
            "keyboardStep",
            <Code>number</Code>,
            <>
              Pixels moved per arrow-key press. Default <Code>10</Code>. Tune it
              when the default step feels too coarse or too fine.
            </>,
          ],
          [
            "keyboardStepFine",
            <Code>number</Code>,
            <>
              Pixels per press while <Kbd>Alt</Kbd>/<Kbd>Option</Kbd> is held.
              Default <Code>1</Code>, for precise nudging.
            </>,
          ],
          [
            "keyboardStepCoarse",
            <Code>number</Code>,
            <>
              Pixels per press while <Kbd>Shift</Kbd> is held. Default{" "}
              <Code>50</Code>, for large jumps.
            </>,
          ],
          [
            "hitAreaMargins",
            <Code>{"{ coarse?: number; fine?: number }"}</Code>,
            <>
              Grabbable margin in px on each side of the visible line. Default{" "}
              <Code>{"{ coarse: 15, fine: 5 }"}</Code> — <Code>fine</Code> for a
              mouse, <Code>coarse</Code> for touch. Enlarge it when the seam is
              thin or the target is touch-first.
            </>,
          ],
          [
            "gutterSize",
            <Code>number</Code>,
            <>
              Pixels of real layout space the handle occupies as a visible
              gutter. Default <Code>0</Code>, a zero-width overlay seam. The
              group reserves it so panels plus gutters sum to the container;
              your <Code>className</Code>/<Code>style</Code> fill it. Invalid
              values fall back to <Code>0</Code> with a dev warning.
            </>,
          ],
          [
            "doubleClickReset",
            <>
              <Code>"before"</Code> | <Code>"after"</Code> | <Code>false</Code>
            </>,
            <>
              Which neighbor resets to its declared defaults on double-click.
              Default <Code>"before"</Code> (the start-side panel);{" "}
              <Code>"after"</Code> resets the end-side panel; <Code>false</Code>{" "}
              turns the gesture off.
            </>,
          ],
          [
            "className / style / div attrs",
            <Code>—</Code>,
            <>
              Forwarded to the root <Code>div</Code>, along with your event
              handlers. <Code>role</Code> and <Code>tabIndex</Code> are
              library-owned and cannot be overridden.
            </>,
          ],
        ]}
      />

      <H2 id="placement">Place it between two panels</H2>
      <P>
        A handle must be a <em>direct sibling</em> sitting between the two{" "}
        <Code>Panel</Code>s it resizes, inside the same group. The group
        resolves which panel is on each side from committed DOM order — so
        fragments, conditionally rendered panels, and keyed reorders are all
        fine, but the handle has to be right there, not tucked inside a wrapper.
      </P>
      <P>
        Two things break adjacency: wrapping the handle in a styling{" "}
        <Code>&lt;div&gt;</Code> (as the hero demo shows), and placing two
        handles back to back with no panel between them. When the group cannot
        find a panel on each side it disables the handle and, in development,
        warns:
      </P>
      <Pre lang="js">{`<PanelResizeHandle> must be a direct DOM sibling between two
adjacent <Panel> components in the same <PanelGroup>. React
fragments are supported, but wrapper elements and consecutive
handles are not.`}</Pre>
      <P>
        To space or style the seam, style the handle element itself — every
        native <Code>div</Code> attribute is forwarded to it. The handle renders
        as a focusable <Code>role="separator"</Code> (the WAI-ARIA
        window-splitter pattern) and manages that role, <Code>tabIndex</Code>,
        and the <Code>aria-value*</Code> attributes for you.
      </P>

      <H2 id="double-click-reset">Double-click to reset</H2>
      <P>
        Double-clicking a handle snaps one of its neighbors back to its default
        size. <Code>doubleClickReset</Code> chooses which: <Code>"before"</Code>{" "}
        (the default) resets the panel on the start side, <Code>"after"</Code>{" "}
        resets the end-side panel, and <Code>false</Code> turns the gesture off.
      </P>
      <Example
        title="doubleClickReset before / after / false"
        caption="doubleClickReset picks which neighbor snaps back to its default size on a double-click."
        whatToTry={[
          "Drag the seam off center",
          "Double-click to reset",
          "Switch which side resets",
        ]}
        source={doubleClickResetSource}
      >
        <DoubleClickReset />
      </Example>
      <P>
        &ldquo;Reset&rdquo; means re-resolving that panel&rsquo;s declarative
        defaults — its <Code>defaultSize</Code>, and{" "}
        <Code>defaultCollapsed</Code> if it is collapsible. It is not an undo:
        it returns to what you declared, not to wherever the panel happened to
        be earlier.
      </P>

      <H2 id="hit-area">Hit area and coarse pointers</H2>
      <P>
        A thin seam is hard to grab, especially on touch. The visible line stays
        narrow while the grabbable zone around it is larger.{" "}
        <Code>hitAreaMargins</Code> sets that zone in pixels on each side of the
        line, with a separate value per pointer type: <Code>fine</Code> for a
        mouse (default <Code>5</Code>) and <Code>coarse</Code> for touch
        (default <Code>15</Code>), which is larger to suit fingertips. The
        library detects a coarse pointer and picks <Code>coarse</Code>{" "}
        automatically.
      </P>
      <P>
        Set <Code>disabled</Code> on a single handle to freeze just that seam
        while the rest of the group stays interactive.
      </P>
      <Example
        title="hitAreaMargins and a disabled handle"
        caption="A wider fine margin grows the grab zone past the thin line; a disabled handle renders but won't drag."
        whatToTry={[
          "Widen the margin, grab off-line",
          "Try dragging the disabled seam",
        ]}
        source={hitAreaAndDisabledSource}
      >
        <HitAreaAndDisabled />
      </Example>
      <P>
        Deeper coverage of touch targets and coarse-pointer sizing lives on{" "}
        <DocLink to="/docs/accessibility">accessibility</DocLink>.
      </P>

      <H2 id="gutter">A gutter that takes up space</H2>
      <P>
        By default a handle is a zero-width overlay: the seam floats on the
        boundary and the two panels meet edge to edge. Give it a{" "}
        <Code>gutterSize</Code> in pixels and the handle instead occupies real
        layout space — a visible gutter between the panels that you style and
        drag like any other seam.
      </P>
      <Example
        title="A draggable gutter"
        caption="gutterSize gives the handle real layout space instead of a zero-width overlay seam."
        whatToTry={[
          "Switch the gutter size",
          "Drag the visible gutter",
          "Set 0 — back to overlay",
        ]}
        source={gutterHandleSource}
      >
        <GutterHandle />
      </Example>
      <P>
        The group reserves every gutter <em>before</em> it distributes the
        container, so panels plus gutters always sum to the container size. The
        handle element spans exactly the gutter — its <Code>className</Code>/
        <Code>style</Code> fill the gutter background while the default
        separator line stays centered in it. The pointer hit area still extends
        past the gutter by <Code>hitAreaMargins</Code> on each side, so a thin
        gutter is easy to grab. Percentage panel sizes keep resolving against
        the group&rsquo;s full content box, not the gutter-reduced remainder.
      </P>

      <H2 id="composing-handlers">Composing your own handlers</H2>
      <P>
        Any interaction handler you pass runs alongside the library&rsquo;s own.
        For cancellable events — <Code>onPointerDown</Code>,{" "}
        <Code>onKeyDown</Code>, <Code>onDoubleClick</Code> — your handler runs
        first, and calling <Code>event.preventDefault()</Code> stops the
        library&rsquo;s action for that event. That is how you veto a drag or
        override a keypress:
      </P>
      <Pre>{`<PanelResizeHandle
  onPointerDown={(event) => {
    if (locked) event.preventDefault(); // library skips the resize
  }}
/>`}</Pre>
      <P>
        The active and terminal pointer events (<Code>onPointerMove</Code>,{" "}
        <Code>onPointerUp</Code>, <Code>onPointerCancel</Code>,{" "}
        <Code>onLostPointerCapture</Code>) are not cancellable: the
        library&rsquo;s cleanup always runs so a drag can never get stuck, and
        any error your handler throws is rethrown only after that cleanup
        finishes.
      </P>
      <Callout title="Keyboard model lives on its own page">
        The three <Code>keyboardStep*</Code> props are declared here, but the
        full keyboard model — arrows, <Kbd>Home</Kbd>/<Kbd>End</Kbd>,{" "}
        <Kbd>Enter</Kbd> to toggle a collapsible neighbor, and RTL behavior — is
        covered on <DocLink to="/docs/accessibility">accessibility</DocLink>.
      </Callout>

      <H2 id="styling">Styling</H2>
      <P>
        The handle forwards <Code>className</Code>, <Code>style</Code>, and the
        rest of its native attributes to its root <Code>div</Code>, so you style
        the seam directly. The built-in separator line takes its color from one
        CSS variable when you keep it instead of supplying your own background,
        and a resting <Code>zIndex</Code> is respected — the full slot and
        variable surface is on{" "}
        <DocLink to="/docs/styling-and-slot-props">
          styling &amp; slot props
        </DocLink>
        .
      </P>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        A wrapped or back-to-back handle disables itself and warns — adjacency
        is resolved from committed DOM order, not your JSX tree. An invalid{" "}
        <Code>gutterSize</Code> (negative or non-finite) falls back to{" "}
        <Code>0</Code> with a dev warning. And during an active drag the library
        bumps the handle&rsquo;s <Code>zIndex</Code> so the dragged line wins at
        the intersection of nested groups; your resting value returns on
        release.
      </P>

      <Related
        items={[
          {
            to: "/docs/panel-group",
            label: "PanelGroup",
            note: "the container a handle drags inside, and its group-wide disabled",
          },
          {
            to: "/docs/panel",
            label: "Panel",
            note: "the panels a handle sits between",
          },
          {
            to: "/docs/accessibility",
            label: "Accessibility",
            note: "the full keyboard model and coarse-pointer hit areas",
          },
          {
            to: "/docs/styling-and-slot-props",
            label: "Styling & slot props",
            note: "the separator variable and per-slot styling",
          },
        ]}
      />
    </div>
  );
}
