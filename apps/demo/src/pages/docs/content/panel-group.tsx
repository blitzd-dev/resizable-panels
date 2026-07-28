import AnimationControl from "../examples/panel-group/animation-control";
import animationControlSource from "../examples/panel-group/animation-control.tsx?raw";
import NestedGroups from "../examples/panel-group/nested-groups";
import nestedGroupsSource from "../examples/panel-group/nested-groups.tsx?raw";
import OrientationToggle from "../examples/panel-group/orientation-toggle";
import orientationToggleSource from "../examples/panel-group/orientation-toggle.tsx?raw";
import RtlAndCursor from "../examples/panel-group/rtl-and-cursor";
import rtlAndCursorSource from "../examples/panel-group/rtl-and-cursor.tsx?raw";
import {
  Callout,
  Code,
  DocLink,
  Example,
  H2,
  P,
  Pre,
  Related,
  Req,
  Table,
} from "../primitives";

export function PanelGroupDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        <Code>PanelGroup</Code> is the container that holds your panels. It lays
        its children out along one axis, and every resize happens inside it — a
        panel or a handle only means something in a group.
      </P>

      <Example
        title="Orientation toggle"
        caption="One prop flips both the stacking direction and the drag axis."
        whatToTry={["Flip orientation, then drag the seam along the new axis"]}
        source={orientationToggleSource}
      >
        <OrientationToggle />
      </Example>

      <H2 id="props">Props</H2>
      <P>
        Every prop <Code>PanelGroup</Code> accepts. The full type is{" "}
        <Code>PanelGroupProps</Code>, a union that enforces <Code>value</Code>{" "}
        XOR <Code>defaultValue</Code> at the type level — TypeScript rejects
        passing both.
      </P>
      <Table
        rows={[
          [
            "orientation",
            <Code>PanelGroupOrientation</Code>,
            <>
              <Req /> Main layout axis: <Code>"horizontal"</Code> or{" "}
              <Code>"vertical"</Code>. Sets both the stacking direction and the
              drag axis.
            </>,
          ],
          [
            "children",
            <Code>ReactNode</Code>,
            <>
              <Req /> The <Code>&lt;Panel&gt;</Code>s and{" "}
              <Code>&lt;PanelResizeHandle&gt;</Code>s to lay out.
            </>,
          ],
          [
            "groupId",
            <Code>string</Code>,
            <>
              Publish this group as a lookup namespace so its panels are
              addressable from <DocLink to="/docs/reading-state">hooks</DocLink>{" "}
              and the dispatcher. Unnamed groups still work but stay private to
              their subtree. Must be non-empty.
            </>,
          ],
          [
            "disabled",
            <Code>boolean</Code>,
            <>
              Default <Code>false</Code>. Disables pointer, keyboard, toggle,
              and reset for <em>every</em> handle in the group at once — the way
              to lock a whole layout without touching each handle.
            </>,
          ],
          [
            "cursorBehavior",
            <Code>PanelCursorBehavior</Code>,
            <>
              Default <Code>"global"</Code>. Cursor policy during a pointer
              resize (see the table below).
            </>,
          ],
          [
            "animation",
            <Code>PanelGroupAnimation</Code>,
            <>
              Controls this group&apos;s library-owned transitions. Omit it for
              the defaults, pass <Code>false</Code> to disable them, or override{" "}
              <Code>durationMs</Code> and <Code>easing</Code>. Nested groups
              manage their own animation.
            </>,
          ],
          [
            "cascade",
            <Code>PanelGroupCascade</Code>,
            <>
              Default <Code>"reversible"</Code>. Chooses whether reversing a
              held pointer drag retraces the cascade or latches pushes until
              space returns.
            </>,
          ],
          [
            "dir",
            <>
              <Code>"ltr"</Code> | <Code>"rtl"</Code>
            </>,
            <>
              Inline direction for horizontal layout; sets which physical edge{" "}
              <Code>start</Code>/<Code>end</Code> map to. Inherited from the DOM
              when omitted.
            </>,
          ],
          [
            "apiRef",
            <Code>Ref&lt;PanelGroupApi&gt;</Code>,
            <>
              Imperative handle to read and replace the group value. See the{" "}
              <DocLink to="/docs/imperative-and-actions">
                imperative API
              </DocLink>
              .
            </>,
          ],
          [
            "value",
            <Code>PanelGroupValue</Code>,
            <>
              Controlled value. Your state stays authoritative; interactions
              emit proposals through <Code>onValueChange</Code>. See{" "}
              <DocLink to="/docs/controlled-state">
                controlled value &amp; events
              </DocLink>
              .
            </>,
          ],
          [
            "defaultValue",
            <Code>PanelGroupValue</Code>,
            <>
              Uncontrolled initial value, and the baseline{" "}
              <Code>resetValue()</Code> returns to.
            </>,
          ],
          [
            "persistence",
            <Code>PanelGroupPersistenceOptions</Code>,
            <>
              Save and restore the layout to storage. Mutually exclusive with{" "}
              <Code>value</Code>. See{" "}
              <DocLink to="/docs/persistence">persistence</DocLink>.
            </>,
          ],
          [
            "onValueChange",
            <Code>(value, details) =&gt; void</Code>,
            <>
              Fires on every actual value change or controlled proposal. Covered
              on{" "}
              <DocLink to="/docs/controlled-state">
                controlled value &amp; events
              </DocLink>
              .
            </>,
          ],
          [
            "onResizeStart",
            <Code>(event) =&gt; void</Code>,
            <>
              Start of a <em>pointer</em> resize transaction, fired when the
              drag actually begins (a press that never moves emits nothing;
              keyboard resizes are atomic and emit no lifecycle).
            </>,
          ],
          [
            "onResizeEnd",
            <Code>(event) =&gt; void</Code>,
            <>
              End of a pointer resize transaction — fires exactly once per
              session, including cancel, lost capture, and unmount.
            </>,
          ],
          [
            "className / style / div attrs",
            <Code>—</Code>,
            <>
              Applied to the root <Code>div</Code>. (<Code>defaultValue</Code>{" "}
              and <Code>dir</Code> are intercepted, not forwarded to the DOM.)
            </>,
          ],
        ]}
      />

      <H2 id="orientation">Orientation and the sizing contract</H2>
      <P>
        <Code>orientation</Code> decides two things at once: the direction
        panels stack, and the axis their shared handle drags along.{" "}
        <Code>"horizontal"</Code> lays panels left-to-right and drags sideways;{" "}
        <Code>"vertical"</Code> stacks them top-to-bottom and drags up and down.
        The group renders a flex <Code>div</Code> and sets its own{" "}
        <Code>flex-direction</Code> from <Code>orientation</Code>, so you never
        add a <Code>flex-row</Code>/<Code>flex-col</Code> class yourself.
      </P>
      <P>
        The group fills its container: it defaults to <Code>width: 100%</Code>{" "}
        and <Code>height: 100%</Code>. A <Code>style</Code> prop overrides
        those; a <Code>className</Code> does not. So the container must have a
        definite size along the main axis. Wrap the group in a sized element
        rather than putting a height class on <Code>PanelGroup</Code> itself,
        where the inline <Code>height: 100%</Code> would silently win. Every
        demo on this page runs inside such a sized container.
      </P>
      <Callout variant="warning" title="Zero along the axis renders nothing">
        If a group measures 0px along its axis while it holds children, its
        panels have no room to lay out — floored panels overflow the clipped box
        and zero-floor panels render nothing. The library emits a development
        warning naming the axis. Give the parent a nonzero size, or pass an
        explicit one through the group&rsquo;s <Code>style</Code> prop.
      </Callout>

      <H2 id="nesting">Nesting builds grids</H2>
      <P>
        A group can live inside another group&rsquo;s panel. Put a vertical
        group inside one panel of a horizontal group and you get an IDE-style
        grid: a full-height sidebar next to an editor stacked over a terminal.
      </P>
      <P>
        Each group is its own boundary. Dragging the inner handle only
        redistributes space between the inner panels; dragging the outer handle
        only moves the sidebar seam. Nothing leaks across the boundary, so you
        can nest as deeply as the layout needs.
      </P>
      <Example
        title="Nested groups"
        caption="A vertical group inside one panel of a horizontal group."
        whatToTry={[
          "Drag the outer seam — only the sidebar moves",
          "Drag an inner seam — space stays inside the inner group",
        ]}
        source={nestedGroupsSource}
        frameClassName="h-72"
      >
        <NestedGroups />
      </Example>

      <H2 id="direction-and-cursor">Direction and cursor policy</H2>
      <P>
        Docked panels anchor to a logical <Code>side</Code> —{" "}
        <Code>"start"</Code> or <Code>"end"</Code> — not a physical edge.{" "}
        <Code>dir</Code> decides how those map to the screen. In{" "}
        <Code>"ltr"</Code> the start edge is on the left; <Code>"rtl"</Code>{" "}
        flips it to the right, and arrow-key resizing inverts to match. Omit{" "}
        <Code>dir</Code> and the group inherits the computed direction from its
        DOM ancestors.
      </P>
      <P>
        <Code>cursorBehavior</Code> controls how the resize cursor is painted
        during a pointer drag. Its type is <Code>PanelCursorBehavior</Code>:
      </P>
      <Table
        headers={["Value", "Type", "Behavior"]}
        rows={[
          [
            '"global"',
            "PanelCursorBehavior",
            "The default. Paints the resize cursor on the whole page for the duration of the drag, so it never flickers back to an arrow when your pointer strays off the thin handle line.",
          ],
          [
            '"handle"',
            "PanelCursorBehavior",
            "Applies the cursor only to the handle's hit area. Cleaner, but a fast drag that outruns the handle shows the cursor of whatever is underneath.",
          ],
          [
            '"none"',
            "PanelCursorBehavior",
            "The library sets no cursor at all — you supply your own with CSS. Use it when a Tailwind cursor class or a design system already owns the cursor.",
          ],
        ]}
      />
      <Example
        title="RTL and cursor policy"
        caption="The handle carries no cursor class, so cursorBehavior alone paints the cursor."
        whatToTry={[
          "Switch cursorBehavior, then drag off the thin handle line",
          "Toggle dir — the start-docked panel jumps edges",
        ]}
        source={rtlAndCursorSource}
      >
        <RtlAndCursor />
      </Example>

      <H2 id="animation">Animation</H2>
      <P>
        The group animates its panels&rsquo; size and collapse transitions with
        a built-in 300ms ease. The <Code>animation</Code> prop —{" "}
        <Code>PanelGroupAnimation</Code> — tunes or turns off that motion for
        this group&rsquo;s panels.
      </P>
      <Example
        title="Animation off / custom duration"
        caption="One sidebar under three settings: default, off, and a slow custom duration."
        whatToTry={[
          "Toggle the sidebar under each mode to feel the difference",
        ]}
        source={animationControlSource}
      >
        <AnimationControl />
      </Example>
      <P>
        Omit <Code>animation</Code> for the default: a 300ms{" "}
        <Code>cubic-bezier(0.4, 0, 0.2, 1)</Code> panel transition and the
        collapse-threshold spring derived from it. Pass <Code>false</Code> to
        disable all library-owned panel transitions <em>and</em> that threshold
        spring for the group. Pass <Code>{"{ durationMs?, easing? }"}</Code> to
        override either field; the one you leave out keeps its default. Invalid
        values — a non-positive or non-finite <Code>durationMs</Code>, a blank
        or non-string <Code>easing</Code> — fall back to the defaults with a dev
        warning.
      </P>
      <P>
        <Code>prefers-reduced-motion</Code> applies independently, and whichever
        is stricter wins: an <Code>animation</Code> prop never overrides a
        viewer&rsquo;s reduced-motion setting. There is no inheritance either —
        the prop governs this group&rsquo;s own panels, and a nested group is
        governed by its own <Code>animation</Code>.
      </P>

      <H2 id="state">Value, defaultValue, and persistence</H2>
      <P>
        Three props govern the group&rsquo;s state, and they are the
        group&rsquo;s state — a <Code>PanelGroupValue</Code> maps each
        panel&rsquo;s <Code>panelId</Code> to its size and collapsed bit.
        Controlled <Code>value</Code> is mutually exclusive with the two
        uncontrolled inputs. The uncontrolled pair combines:{" "}
        <Code>defaultValue</Code> is the SSR and first-paint fallback rendered
        until a <Code>persistence</Code> (a{" "}
        <Code>PanelGroupPersistenceOptions</Code>) restore resolves, and the
        baseline <Code>resetValue()</Code> returns to.
      </P>
      <P>
        So use controlled <Code>value</Code> on its own, or pair uncontrolled{" "}
        <Code>defaultValue</Code> with <Code>persistence</Code>. Mixing{" "}
        <Code>value</Code> with <Code>defaultValue</Code> or{" "}
        <Code>persistence</Code> logs a dev warning, and the controlled path
        wins. Each mode is owned by its own page:{" "}
        <DocLink to="/docs/controlled-state">
          controlled value &amp; events
        </DocLink>{" "}
        and <DocLink to="/docs/persistence">persistence</DocLink>.
      </P>

      <H2 id="providers">Groups and providers</H2>
      <P>
        A standalone group installs its own provider boundary automatically, so
        the examples above need no wrapper. You only reach for an explicit{" "}
        <Code>PanelProvider</Code> to share one lookup namespace across sibling
        groups, or to drive a group from a toolbar rendered outside it. Two
        sibling standalone groups get independent implicit providers, so
        cross-group lookup needs a shared explicit one.
      </P>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        A group value is keyed by each panel&rsquo;s <Code>panelId</Code>, and
        key order carries no meaning — your React children own the visual order:
      </P>
      <Pre lang="tsx">{`// Same layout regardless of key order — React children decide the order.
<PanelGroup orientation="horizontal" defaultValue={{ main: { size: 400 }, side: { size: 200 } }}>
  <Panel side="start" panelId="side" defaultSize={200} />
  <PanelResizeHandle />
  <Panel panelId="main" />
</PanelGroup>`}</Pre>
      <P>
        A few more: a duplicate <Code>panelId</Code> within one group warns and
        collapses to the first; an empty <Code>groupId</Code> or{" "}
        <Code>persistence.key</Code> warns; and <Code>onValueChange</Code>{" "}
        reports the accepted, reconciled value — in controlled mode the prop
        does not change until you set it.
      </P>

      <Related
        items={[
          {
            to: "/docs/panel",
            label: "Panels",
            note: "fill the group with them",
          },
          {
            to: "/docs/panel-resize-handle",
            label: "Resize handles",
            note: "put them between panels",
          },
          {
            to: "/docs/sizing",
            label: "Sizing",
            note: "the SizeSpec grammar",
          },
          {
            to: "/docs/mental-model",
            label: "Mental model",
            note: "how groups, panels, and identity fit together",
          },
        ]}
      />
    </div>
  );
}
