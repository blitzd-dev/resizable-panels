import ControlledCollapsed from "../examples/controlled-state/controlled-collapsed";
import controlledCollapsedSource from "../examples/controlled-state/controlled-collapsed.tsx?raw";
import ControlledValue from "../examples/controlled-state/controlled-value";
import controlledValueSource from "../examples/controlled-state/controlled-value.tsx?raw";
import ResizeLifecycle from "../examples/controlled-state/resize-lifecycle";
import resizeLifecycleSource from "../examples/controlled-state/resize-lifecycle.tsx?raw";
import UncontrolledDefault from "../examples/controlled-state/uncontrolled-default";
import uncontrolledDefaultSource from "../examples/controlled-state/uncontrolled-default.tsx?raw";
import ValueChangeMetadata from "../examples/controlled-state/value-change-metadata";
import valueChangeMetadataSource from "../examples/controlled-state/value-change-metadata.tsx?raw";
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

export function ControlledStateDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        A group has one piece of observable state: its <em>value</em> — the size
        and collapsed bit of each panel. This page covers owning that value —
        seeding it once, or controlling it fully from your own state — and
        observing every change, with metadata that says where each change came
        from.
      </P>

      <H2 id="the-value">What the value is</H2>
      <P>
        A group&rsquo;s value is a <Code>PanelGroupValue</Code>: a plain object
        keyed by each panel&rsquo;s <Code>panelId</Code>. Each entry is a{" "}
        <Code>PanelValue</Code> — the panel&rsquo;s preferred size in pixels,
        plus its collapsed bit when it can collapse.
      </P>
      <Pre lang="ts">{`type PanelValue = { size: number; collapsed?: boolean };
type PanelGroupValue = Record<string, PanelValue>; // keyed by panelId`}</Pre>
      <P>
        Two rules matter. The keys are <Code>panelId</Code>s, so a panel appears
        in the value only if you gave it a <Code>panelId</Code> — anonymous
        panels stay fully resizable but never show up. And the key order carries
        no meaning: your React children own the visual order, so the
        object&rsquo;s key order is irrelevant.
      </P>

      <H2 id="seeding">Seed with defaultValue</H2>
      <P>
        The gentlest way to set a starting layout is <Code>defaultValue</Code>.
        You hand the group an initial <Code>PanelGroupValue</Code> and step
        back: the group owns its state from there, and drags update it directly.
        This is the uncontrolled path.
      </P>
      <Example
        title="Seed the starting layout with defaultValue"
        caption="defaultValue seeds the initial layout once, then the group owns its own state."
        whatToTry={["Drag the seam", "Collapse the sidebar"]}
        source={uncontrolledDefaultSource}
      >
        <UncontrolledDefault />
      </Example>
      <P>
        <Code>defaultValue</Code> is read once, at first paint. Changing it
        later does nothing — the group has already taken ownership. It is also
        the baseline <Code>resetValue()</Code> returns to (see the{" "}
        <DocLink to="/docs/imperative-and-actions">imperative API</DocLink>),
        and the first-paint fallback while a persisted layout is still loading
        (see <DocLink to="/docs/persistence">persistence</DocLink>).
      </P>

      <H2 id="controlling">Control with value and onValueChange</H2>
      <P>
        When your app needs to own the layout — store it in a reducer, sync it
        across views, gate it behind a permission — use the <Code>value</Code>{" "}
        prop instead. Now the prop is authoritative: the panels render exactly
        what <Code>value</Code> says.
      </P>
      <P>
        The key idea: with <Code>value</Code> set, dragging a handle does not
        change the layout by itself. The group calls <Code>onValueChange</Code>{" "}
        with a <em>proposed</em> next value, and nothing moves until you feed a
        new <Code>value</Code> back down. Applying the proposal usually means
        storing it in state; declining it means ignoring it, and the layout
        snaps back to the current prop.
      </P>
      <Example
        title="Fully controlled, with a lock that declines proposals"
        caption="With value set, a drag only proposes; the lock ignores the proposal and the seam snaps back."
        whatToTry={["Drag while accepting", "Lock, then drag — it snaps back"]}
        source={controlledValueSource}
      >
        <ControlledValue />
      </Example>
      <Callout variant="warning" title="One owner per group">
        <Code>value</Code>, <Code>defaultValue</Code>, and{" "}
        <DocLink to="/docs/persistence">
          <Code>persistence</Code>
        </DocLink>{" "}
        are mutually exclusive ways to own the state — pick exactly one per
        group. Passing <Code>value</Code> alongside either of the others warns
        in development, and the controlled path wins.
      </Callout>

      <H2 id="controlled-collapsed">Control one panel&rsquo;s collapsed bit</H2>
      <P>
        The same proposal model works at the single-panel grain. A collapsible{" "}
        <Code>Panel</Code> takes a controlled <Code>collapsed</Code> boolean
        that mirrors the group&rsquo;s <Code>value</Code>: the prop is
        authoritative, and every path that would collapse or expand the panel —
        an imperative action, <Kbd>Enter</Kbd> on the handle, a drag past{" "}
        <Code>collapseBelow</Code>, a group command — emits a proposal through{" "}
        <Code>onCollapsedChange</Code> instead of applying itself. Your parent
        accepts by re-rendering with the new value; ignoring the proposal
        declines it, and the panel snaps back.
      </P>
      <Example
        title="Controlled collapsed, with an accept/decline toggle"
        caption="A controlled collapsed prop turns every collapse path into a proposal you accept or decline."
        whatToTry={[
          "Toggle from app state — always applies",
          "Decline, then press Enter on the seam",
          "Decline, then drag past 110px",
        ]}
        source={controlledCollapsedSource}
      >
        <ControlledCollapsed />
      </Example>
      <P>
        The button drives the parent state directly, so it always applies.{" "}
        <Kbd>Enter</Kbd> on the handle and a drag past 110px emit proposals
        instead: while declining, the drag previews the collapse live but snaps
        back at release, and <Kbd>Enter</Kbd> does nothing. A few precedence
        rules round out the contract. <Code>collapsed</Code> is mutually
        exclusive with <Code>defaultCollapsed</Code> and requires{" "}
        <Code>collapsible</Code> — it is inert (and warns) on a non-collapsible
        panel. Persistence restores skip the collapsed field for a controlled
        panel (its size still restores), and every readout —{" "}
        <Code>usePanelControls().collapsed</Code>, <Code>isCollapsed()</Code>,
        the group&rsquo;s <Code>getValue()</Code> — reports the effective prop
        state.
      </P>

      <H2 id="observing">Observe every change</H2>
      <P>
        Controlled or not, <Code>onValueChange</Code> fires on every committed
        change with a second argument, <Code>PanelGroupValueChangeDetails</Code>
        , describing it:
      </P>
      <Pre lang="ts">{`type PanelGroupValueChangeDetails = {
  previousValue: PanelGroupValue;    // baseline this change moved from
  reason: PanelValueChangeReason;    // what operation happened
  trigger: PanelValueChangeTrigger;  // what input drove it
  handleId?: string;                 // the acting handle, when one was involved
};`}</Pre>
      <P>
        Individual panels expose the same idea at a finer grain:{" "}
        <Code>onSizeChange</Code> and <Code>onCollapsedChange</Code> report one
        panel each, carrying a lighter <Code>PanelChangeDetails</Code> (just{" "}
        <Code>reason</Code> and <Code>trigger</Code>). All of these are
        mount-suppressed — the initial render does not fire them, so you only
        hear about real changes.
      </P>
      <Example
        title="Reading change metadata (group and per-panel)"
        caption="Every change carries a reason and a trigger, at both group and per-panel grain."
        whatToTry={[
          "Drag the seam — watch trigger=pointer",
          "Arrow-key the handle — trigger=keyboard",
          "Press Enter to collapse — reason=collapse",
        ]}
        source={valueChangeMetadataSource}
        frameClassName="h-72"
      >
        <ValueChangeMetadata />
      </Example>
      <P>
        <Code>previousValue</Code> is the value this change moved from. Within a
        single pointer drag, the first change uses the value at the start of the
        drag as its baseline — not some older event — so a drag reads as one
        coherent move from where it began.
      </P>

      <H2 id="reason-trigger">Reason and trigger</H2>
      <P>
        <Code>reason</Code> and <Code>trigger</Code> are orthogonal:{" "}
        <Code>reason</Code> is <em>what operation</em> happened, independent of
        the device; <Code>trigger</Code> is <em>what input</em> drove it. A
        collapse from a click and a collapse from a keypress share a{" "}
        <Code>reason</Code> but differ in <Code>trigger</Code>.
      </P>
      <Table
        headers={["Field", "Type", "Values"]}
        rows={[
          [
            "reason",
            <Code key="v">PanelValueChangeReason</Code>,
            <>
              One of <Code>"resize"</Code>, <Code>"collapse"</Code>,{" "}
              <Code>"expand"</Code>, <Code>"set-value"</Code>,{" "}
              <Code>"reset"</Code>, <Code>"container-resize"</Code>,{" "}
              <Code>"restore"</Code>, <Code>"children"</Code>. Tells a user drag
              (<Code>"resize"</Code>) apart from a <Code>setValue()</Code> (
              <Code>"set-value"</Code>), a persisted layout loading (
              <Code>"restore"</Code>), or panels mounting and unmounting (
              <Code>"children"</Code>).
            </>,
          ],
          [
            "trigger",
            <Code key="v">PanelValueChangeTrigger</Code>,
            <>
              One of <Code>"pointer"</Code>, <Code>"keyboard"</Code>,{" "}
              <Code>"api"</Code>, <Code>"system"</Code>. Attributes a change to
              a human gesture versus your own imperative call (
              <Code>"api"</Code>) versus something the environment did (
              <Code>"system"</Code> — a container resize, a persistence restore,
              a membership change).
            </>,
          ],
        ]}
      />
      <P>
        Some reasons never reach <Code>onValueChange</Code> at all. Pure child
        reorders, internal canonicalization (a relative default resolving to
        pixels once the container is measured), and pointer sessions that did
        not move anything are recorded internally but not emitted, so your
        handler only hears real, settled changes.
      </P>

      <H2 id="resize-lifecycle">The pointer resize lifecycle</H2>
      <P>
        <Code>onValueChange</Code> fires many times during a drag — once per
        committed step. When you instead want to bracket the whole gesture —
        start a preview, defer an expensive sync until the user lets go — use
        the pointer lifecycle: <Code>onResizeStart</Code> and{" "}
        <Code>onResizeEnd</Code>.
      </P>
      <Pre lang="ts">{`type PanelResizeStartEvent = { handleId?: string; value: PanelGroupValue };
type PanelResizeEndEvent = {
  handleId?: string;
  initialValue: PanelGroupValue; // value when the drag started
  value: PanelGroupValue;        // value when the drag ended
  canceled: boolean;             // ended via cancel / lost capture / exception
};`}</Pre>
      <P>
        These are pointer only. The lifecycle brackets actual movement, not the
        press: <Code>onResizeStart</Code> fires once when the drag truly begins
        — the first pointer move past a small threshold — so a press-and-release
        that never moves emits nothing at all. Once a session has started,{" "}
        <Code>onResizeEnd</Code> fires exactly once when it finishes — including
        the cancel paths, where <Code>canceled</Code> is <Code>true</Code> (
        <Kbd>Escape</Kbd> mid-drag, a lost pointer, a blur, an unmount). The
        final drag value was already delivered through{" "}
        <Code>onValueChange</Code>; <Code>onResizeEnd</Code> reports the settled
        result without re-emitting it.
      </P>
      <Example
        title="onResizeStart / onResizeEnd, including canceled drags"
        caption="The pointer lifecycle brackets a drag; a canceled drag still fires onResizeEnd with canceled: true."
        whatToTry={[
          "Drag and release — start then end",
          "Drag, then press Escape — canceled=true",
          "Arrow-key the handle — no lifecycle fires",
        ]}
        source={resizeLifecycleSource}
        frameClassName="h-72"
      >
        <ResizeLifecycle />
      </Example>
      <Callout title="Keyboard resizing is atomic">
        Each arrow-key press is a single value change: it fires{" "}
        <Code>onValueChange</Code> (with <Code>{'trigger: "keyboard"'}</Code>)
        and nothing else — no start/end pair. If you commit work in{" "}
        <Code>onResizeEnd</Code>, keyboard users never reach it; handle them off{" "}
        <Code>onValueChange</Code> as well.
      </Callout>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        <Code>onValueChange</Code> reports the accepted, reconciled value — in
        controlled mode the prop does not change until you set it, so a declined
        proposal leaves <Code>value</Code> untouched. A press that never moves
        fires no lifecycle and no value change. And a panel with a controlled{" "}
        <Code>collapsed</Code> prop inside a group that also has a controlled{" "}
        <Code>value</Code> lets the panel prop win for that panel&rsquo;s bit —
        a dev-warned misconfiguration where the group-value application proposes
        rather than fights the prop.
      </P>

      <Related
        items={[
          {
            to: "/docs/persistence",
            label: "Persistence",
            note: "the third way to own the value: read and write it to storage",
          },
          {
            to: "/docs/imperative-and-actions",
            label: "Imperative API",
            note: "drive the value from code, reported through these same events",
          },
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: "the panel props behind the collapsed field in the value",
          },
          {
            to: "/docs/reading-state",
            label: "Reading state with hooks",
            note: "subscribe to one panel's live size and collapsed state",
          },
        ]}
      />
    </div>
  );
}
