import AccessibleRail from "../examples/accessibility/accessible-rail";
import accessibleRailSource from "../examples/accessibility/accessible-rail.tsx?raw";
import DisabledHandle from "../examples/accessibility/disabled-handle";
import disabledHandleSource from "../examples/accessibility/disabled-handle.tsx?raw";
import KeyboardResize from "../examples/accessibility/keyboard-resize";
import keyboardResizeSource from "../examples/accessibility/keyboard-resize.tsx?raw";
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

export function AccessibilityDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        Every resize a mouse can do, the keyboard can do too. Each{" "}
        <Code>PanelResizeHandle</Code> is a real, focusable separator: a user
        can Tab to it, move it with the arrow keys, and hear a screen reader
        announce where the boundary sits. Pressing a handle focuses it as well,
        so a rough mouse drag can hand off to precise arrow-key nudges. This
        page is the full keyboard and accessibility contract — the key bindings,
        how focus is acquired and shown, what the handle exposes to assistive
        tech, and how a panel collapsed to nothing stays reopenable.
      </P>

      <H2 id="keyboard-model">Resizing from the keyboard</H2>
      <P>
        Tab to a handle and it takes focus. From there the arrow keys move the
        seam, and modifier keys change how far each press travels. Focus the
        seam in the demo below and try each binding; the <Code>dir</Code> toggle
        shows how right-to-left layouts behave.
      </P>
      <Example
        title="Keyboard-driven resize"
        caption="Tab to a seam and the arrow keys move it; modifiers scale each step."
        whatToTry={[
          "Tab to the seam, then arrow",
          "Hold Shift or Alt while arrowing",
          "Toggle dir — arrows follow",
        ]}
        source={keyboardResizeSource}
      >
        <KeyboardResize />
      </Example>
      <P>
        The bindings are fixed — the handle owns them so behavior is consistent
        everywhere:
      </P>
      <Table
        headers={["Keys", "Action", "Notes"]}
        rows={[
          [
            "Arrow keys",
            "Step by keyboardStep",
            <>
              Move the seam by one step. <Kbd>←</Kbd>/<Kbd>→</Kbd> in a
              horizontal group, <Kbd>↑</Kbd>/<Kbd>↓</Kbd> in a vertical one.
            </>,
          ],
          [
            "Shift + Arrow",
            "Step by keyboardStepCoarse",
            "A larger jump for covering distance quickly.",
          ],
          [
            "Alt / Option + Arrow",
            "Step by keyboardStepFine",
            <>
              A smaller nudge for precise adjustment. If both <Kbd>Alt</Kbd> and{" "}
              <Kbd>Shift</Kbd> are held, <Kbd>Alt</Kbd> wins.
            </>,
          ],
          [
            "Home / End",
            "Run the seam to its limit",
            <>
              Move the seam as far as the layout allows toward the start or the
              end — the same limits the handle reports as{" "}
              <Code>aria-valuemin</Code> and <Code>aria-valuemax</Code>. Never
              inverted by direction.
            </>,
          ],
          [
            "Enter",
            "Toggle the adjacent collapsible panel",
            "Collapse or expand the neighbor that is collapsible. Does nothing if neither side can collapse.",
          ],
        ]}
      />
      <P>
        In a horizontal group whose <Code>dir</Code> is <Code>"rtl"</Code>, the
        left and right arrows swap, so an arrow always moves the seam the way it
        visually points. <Kbd>Home</Kbd> and <Kbd>End</Kbd> are anchored to the
        panel&rsquo;s bounds, not the screen, so they are never flipped. With{" "}
        <Code>collapseBelow</Code> armed the seam can travel below{" "}
        <Code>minSize</Code>, so <Kbd>Home</Kbd> crosses the collapse threshold
        and runs the panel shut to its <Code>collapsedSize</Code> — the value{" "}
        <Code>aria-valuemin</Code> reports — rather than stopping at{" "}
        <Code>minSize</Code>.
      </P>
      <P>
        A keyboard resize is atomic: it commits in one step and fires{" "}
        <Code>onValueChange</Code> once, with its <Code>trigger</Code> reported
        as <Code>"keyboard"</Code>. It does not open a drag transaction, so the{" "}
        <Code>onResizeStart</Code> / <Code>onResizeEnd</Code> lifecycle stays
        pointer-only — see{" "}
        <DocLink to="/docs/controlled-state">
          Controlled value &amp; events
        </DocLink>
        .
      </P>

      <H2 id="keyboard-step">Tuning the step size</H2>
      <P>
        Three props on the handle set how far each keypress moves the seam, all
        in pixels, one per modifier: <Code>keyboardStep</Code> is the baseline
        for a plain arrow, <Code>keyboardStepCoarse</Code> the larger jump under{" "}
        <Kbd>Shift</Kbd>, and <Code>keyboardStepFine</Code> the small nudge
        under <Kbd>Alt</Kbd>/<Kbd>Option</Kbd>. The defaults suit a typical
        layout; raise them for a large surface, lower them where the reader
        needs precision. Make the coarse step large enough that a few presses
        cross the panel, and drop the fine step to a single pixel for exact
        placement.
      </P>
      <P>
        A value that is not a finite number greater than zero is ignored: the
        handle falls back to that prop&rsquo;s default and warns once in
        development. These three props live on the handle alongside its other
        options — see{" "}
        <DocLink to="/docs/panel-resize-handle">Resize handles</DocLink> for
        their types and defaults.
      </P>

      <H2 id="pointer-handoff">Handing off from the pointer</H2>
      <P>
        Pressing a handle focuses it. That is the whole point of the WAI-ARIA
        window-splitter pattern: drag the seam roughly with the mouse, release,
        and the arrow keys immediately fine-tune from where you let go. Focus
        persists after the release, so <Kbd>Tab</Kbd> continues from the divider
        instead of restarting at the top of the page.
      </P>
      <P>
        A press without any movement counts — a plain click focuses the seam and
        emits nothing else. Even a seam that cannot be dragged takes focus this
        way, which is what puts <Kbd>Enter</Kbd> one keystroke from a collapsed
        panel. Focus is never stolen mid-gesture: only a direct press on the
        handle focuses it, so a text selection sweeping across the group leaves
        focus alone.
      </P>

      <H2 id="focus-visibility">What focus looks like</H2>
      <P>
        The separator line is the built-in focus indication, and it follows
        keyboard modality — the platform <Code>:focus-visible</Code> convention.
        Tab to a handle and its separator lights on arrival. Click one and
        nothing lights up: the handle is genuinely focused — arrows work,{" "}
        <Kbd>Tab</Kbd> continues from it — but pointer-acquired focus is
        visually silent, so a released drag leaves the layout at rest. The first
        key pressed afterwards upgrades the modality and lights the seam, a bare{" "}
        <Kbd>Shift</Kbd> included. That upgrade lands in the same commit as the
        resize it triggers, so clicking a seam and then pressing <Kbd>←</Kbd>{" "}
        both moves it and lights it on that one keystroke.
      </P>
      <P>
        Keyboard focus is never invisible. A focused handle renders its line
        even at a group&rsquo;s content edges, where a resting seam would
        normally be suppressed — including the toggle-only seam beside a panel
        collapsed to nothing. A keyboard user can always see which seam they are
        about to move.
      </P>
      <P>
        A lit handle also carries <Code>data-active</Code>, so you can style the
        focused state yourself.
      </P>
      <P>
        Focus is also resilient to layout changes. If the handle that currently
        holds focus unmounts — a panel is removed, or a run of collapsed panels
        collapses the seam — focus moves to the nearest remaining enabled handle
        in the same group rather than falling back to the document body. A
        keyboard user does not get dumped to the top of the page mid-task.
      </P>

      <H2 id="zero-collapsed">Reopening a panel collapsed to nothing</H2>
      <P>
        A <Code>collapsedSize</Code> of <Code>0</Code> takes the panel off
        screen entirely: its content is marked <Code>aria-hidden</Code> and{" "}
        <Code>inert</Code>, so it leaves both the accessibility tree and the tab
        order. The seam beside it does not go with it. That handle is published{" "}
        <em>toggle-only</em> — it keeps <Code>tabIndex 0</Code>, reports no{" "}
        <Code>aria-disabled</Code>, carries <Code>data-toggle-only</Code>, and{" "}
        <Kbd>Enter</Kbd> expands the collapsed panel. Dragging it is inert by
        design: the cursor stays default and a press never starts a resize, it
        only takes focus.
      </P>
      <P>
        The rule is narrow on purpose. A handle becomes toggle-only when exactly
        one of its immediate neighbors is a zero-collapsed collapsible panel and
        the collapsed run reaches the edge of the group — the case where no
        visible pair of panels is left to claim the seam. A handle buried
        between two zero-collapsed panels, or one whose seam still separates two
        visible panels, stays fully disabled instead. <Code>disabled</Code> on
        the group or on either panel still wins over everything.
      </P>
      <P>
        Collapse to a non-zero rail and the trade is different: the panel keeps
        its size, so it stays in the accessibility tree and the tab order. Its
        handle, though, stops responding once the panel is collapsed unless you
        add <Code>resizableWhenCollapsed</Code> — without it the handle is
        disabled outright, with no <Kbd>Enter</Kbd> path either. Collapse the
        rail and Tab to each seam to feel the difference.
      </P>
      <Example
        title="A draggable rail vs. an Enter-only seam"
        caption="resizableWhenCollapsed keeps the rail draggable; the collapsedSize-0 end panel leaves an Enter-only seam."
        whatToTry={[
          "Collapse the rail, then drag it",
          "Tab to each seam",
          "Enter the right seam to reopen",
        ]}
        source={accessibleRailSource}
      >
        <AccessibleRail />
      </Example>
      <Callout title="No collapsed panel is ever stranded">
        Between the toggle-only seam and <Code>resizableWhenCollapsed</Code>,{" "}
        <Kbd>Enter</Kbd> always reopens. It still assumes the user finds the
        seam, so where reopening matters — a sidebar holding navigation, say —
        give it an obvious control too: a toolbar button or menu item wired to{" "}
        <Code>expand()</Code>, alongside the handle rather than instead of it.
      </Callout>

      <H2 id="aria-contract">What the handle exposes to assistive tech</H2>
      <P>
        The handle implements the WAI-ARIA window-splitter pattern. It renders a{" "}
        <Code>role="separator"</Code> element that is focusable (
        <Code>tabIndex 0</Code>), and it keeps a set of ARIA attributes in sync
        as the seam moves — you do not set any of these yourself:
      </P>
      <Table
        headers={["Attribute", "Value", "Meaning"]}
        rows={[
          [
            "role",
            <Code>"separator"</Code>,
            "Announces the element as a splitter. Library-owned; you cannot override it.",
          ],
          [
            "tabIndex",
            <>
              <Code>0</Code> (<Code>−1</Code> when disabled)
            </>,
            "Puts the handle in the tab order. A disabled handle drops out of it; a toggle-only handle stays in. Library-owned.",
          ],
          [
            "aria-orientation",
            <>
              <Code>"horizontal"</Code> | <Code>"vertical"</Code>
            </>,
            "The separator's own orientation, which is perpendicular to the group's axis.",
          ],
          [
            "aria-controls",
            "panel ids",
            "Points at the two panels the seam sits between (their rendered DOM ids).",
          ],
          [
            "aria-valuemin / max / now",
            "numbers",
            <>
              The adjacent panel&rsquo;s reachable bounds and current size in
              pixels, so a screen reader can announce the position. A
              toggle-only seam announces a zero-width range (min = now = max),
              because it cannot travel.
            </>,
          ],
          [
            "aria-valuetext",
            "string",
            <>
              A readable version of the same numbers —{" "}
              <Code>"240 pixels before, 560 pixels after"</Code> — naming the
              collapsed side on a toggle-only seam (a zero-collapsed collapsible
              at the group edge).
            </>,
          ],
          [
            "aria-disabled",
            <>
              <Code>true</Code> when disabled
            </>,
            "Set when the handle is disabled so assistive tech reports it as inactive. A toggle-only handle is not disabled and does not carry it.",
          ],
        ]}
      />
      <P>
        Because these come from real panel state, they stay correct after
        pointer drags, keyboard steps, and container resizes alike.
      </P>

      <H2 id="disabled">Disabled handles</H2>
      <P>
        A disabled handle is removed from the keyboard path entirely: its{" "}
        <Code>tabIndex</Code> becomes <Code>−1</Code> so Tab skips it, and it
        reports <Code>aria-disabled</Code>. You can disable a single seam with{" "}
        <Code>disabled</Code> on the handle, or every seam at once with{" "}
        <Code>disabled</Code> on the group. Either way the handle still renders,
        so the layout does not shift — it simply stops responding to pointer and
        keyboard input, <Kbd>Enter</Kbd> included.
      </P>
      <Example
        title="Disabling a seam"
        caption="Disabled on the handle locks one seam; disabled on the group locks every seam at once."
        whatToTry={[
          "Switch scope, then drag the seam",
          "Tab across — a disabled seam is skipped",
        ]}
        source={disabledHandleSource}
      >
        <DisabledHandle />
      </Example>

      <H2 id="reduced-motion">Reduced motion</H2>
      <P>
        The library watches <Code>prefers-reduced-motion: reduce</Code> and
        suppresses its own transitions when the viewer asks for less motion:
        panel size and collapse animations, the collapse-threshold spring, and
        the handle&rsquo;s focus-line fade all drop to an instant change. This
        is automatic and global — you never read the media query or branch on it
        in your own components.
      </P>
      <P>
        It also outranks the group&rsquo;s <Code>animation</Code> prop: the two
        apply independently and the stricter one wins, so a viewer&rsquo;s
        reduced-motion setting is never overridden by a longer{" "}
        <Code>durationMs</Code>. See{" "}
        <DocLink to="/docs/panel-group">PanelGroup</DocLink> for the{" "}
        <Code>animation</Code> prop and{" "}
        <DocLink to="/docs/collapsing">Collapsing</DocLink> for the collapse
        motion it governs.
      </P>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        The handle sets <Code>outline: none</Code> inline, so an outline utility
        class silently does nothing on a focused seam — reach for a ring (a box
        shadow) instead, or pass <Code>outline</Code> through the{" "}
        <Code>style</Code> prop.
      </P>
      <Pre>{`<PanelResizeHandle
  className="focus-visible:ring-2 focus-visible:ring-primary"
/>`}</Pre>
      <P>
        Two more edges to watch: <Code>aria-controls</Code> stays empty of
        meaning until the two neighboring panels carry a DOM <Code>id</Code>{" "}
        (the native attribute, distinct from <Code>panelId</Code>); and because
        a <Code>disabled</Code> seam ignores <Kbd>Enter</Kbd> too, a panel
        reachable only through one has no keyboard reopen — keep{" "}
        <Code>resizableWhenCollapsed</Code> or an explicit <Code>expand()</Code>{" "}
        control in reach.
      </P>

      <Related
        items={[
          {
            to: "/docs/panel-resize-handle",
            label: "Resize handles",
            note: "the full prop list for the handle these bindings live on",
          },
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: "collapsedSize, resizableWhenCollapsed, and the rest of the collapse model",
          },
          {
            to: "/docs/responsive",
            label: "Responsive layouts",
            note: "touch targets and coarse-pointer hit areas, the pointer counterpart to this page",
          },
        ]}
      />
    </div>
  );
}
