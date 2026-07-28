import CollapsedBadge from "../examples/reading-state/collapsed-badge";
import collapsedBadgeSource from "../examples/reading-state/collapsed-badge.tsx?raw";
import ControlsReadout from "../examples/reading-state/controls-readout";
import controlsReadoutSource from "../examples/reading-state/controls-readout.tsx?raw";
import GroupStateSwap from "../examples/reading-state/group-state-swap";
import groupStateSwapSource from "../examples/reading-state/group-state-swap.tsx?raw";
import InteractionIndicator from "../examples/reading-state/interaction-indicator";
import interactionIndicatorSource from "../examples/reading-state/interaction-indicator.tsx?raw";
import RegistryList from "../examples/reading-state/registry-list";
import registryListSource from "../examples/reading-state/registry-list.tsx?raw";
import {
  Callout,
  Code,
  DocLink,
  Example,
  H2,
  P,
  Pre,
  Related,
  Table,
} from "../primitives";

export function ReadingStateDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        Five read hooks let any component &mdash; a status bar, a badge, a
        custom control, an overlay &mdash; subscribe to live panel state and
        re-render when it changes. Each subscribes to a different slice: one
        panel, a whole group, the group&rsquo;s size, or provider-wide activity.
        Pick the one that reads the least, because every hook re-renders its
        component exactly when the thing it subscribes to changes.
      </P>

      <H2 id="one-panels-controls">Reading one panel</H2>
      <P>
        <Code>usePanelControls(locator)</Code> subscribes to a single panel and
        returns its <Code>PanelControls</Code>: the live size, collapsed flag,
        constraints, and more. It takes a <Code>PanelLocator</Code> &mdash; the{" "}
        <Code>groupId</Code> the group published plus the panel&rsquo;s{" "}
        <Code>panelId</Code>. Drag the handle or the collapse rail and the
        readout tracks it.
      </P>
      <Example
        title="Live controls readout"
        caption="usePanelControls tracks one panel's live size, collapsed flag, and constraints."
        whatToTry={[
          "Drag the seam",
          "Toggle collapse",
          "Watch size vs renderedSize",
        ]}
        source={controlsReadoutSource}
      >
        <ControlsReadout />
      </Example>
      <P>
        The hook returns <Code>undefined</Code> until the panel is resolvable
        &mdash; that is, until its group has published a <Code>groupId</Code>{" "}
        and the panel has mounted. Guard for that first, as the example does,
        then read the fields.
      </P>
      <P>
        Two size fields exist because they can differ. <Code>size</Code> is the{" "}
        <em>preferred</em> size &mdash; what the user or an action last asked
        for. <Code>renderedSize</Code> is what is actually on screen, which
        diverges when the panel is collapsed or clamped by a constraint. Toggle
        collapse and watch <Code>size</Code> hold while{" "}
        <Code>renderedSize</Code> drops to the collapsed rail width. The{" "}
        <Code>constraints</Code> field carries the resolved <Code>minSize</Code>
        /<Code>maxSize</Code>/<Code>collapsedSize</Code> in pixels &mdash; the
        bounds you need to build a size slider or a min/max label.{" "}
        <Code>PanelControls</Code> is discriminated on <Code>kind</Code>: a{" "}
        <Code>"docked"</Code> panel carries a <Code>side</Code>, a{" "}
        <Code>"peer"</Code> does not, so narrow on <Code>kind</Code> before
        reading <Code>side</Code>.
      </P>

      <H2 id="narrow-subscriptions">Subscribing to less: the collapsed flag</H2>
      <P>
        Every drag frame changes a panel&rsquo;s size, so a component that reads
        the whole <Code>PanelControls</Code> object re-renders on every frame of
        a drag. If all you care about is whether the panel is collapsed, that is
        wasted work. <Code>usePanelCollapsed(locator)</Code> subscribes to only
        the collapsed boolean: a size-only drag notifies the store, but the
        boolean stays equal, so your component does not re-render until the
        panel actually collapses or expands.
      </P>
      <Example
        title="Collapsed flag vs full controls"
        caption="usePanelCollapsed skips every size-drag frame; usePanelControls re-renders on all of them."
        whatToTry={[
          "Drag the seam — watch the counters",
          "Toggle collapse — both tick once",
        ]}
        source={collapsedBadgeSource}
      >
        <CollapsedBadge />
      </Example>
      <P>
        Both counters watch the same panel. Drag the handle and the right-hand
        render counter (<Code>usePanelControls</Code>) climbs every frame while
        the left-hand one (<Code>usePanelCollapsed</Code>) stays put. Toggle
        collapse and both tick once. That gap is the whole argument for choosing
        the narrowest hook.
      </P>

      <H2 id="whole-group-snapshot">A whole group at once</H2>
      <P>
        <Code>usePanelRegistry(groupId)</Code> returns a live snapshot of every
        named panel in one published group, keyed by <Code>panelId</Code>. Each
        value is a full <Code>PanelControls</Code>. Reach for it when your UI is
        a list <em>of</em> panels &mdash; an outline, a layout inspector, a set
        of per-panel toggles &mdash; rather than a view of one.
      </P>
      <Example
        title="Live group snapshot"
        caption="usePanelRegistry returns every named panel in one group, keyed by panelId."
        whatToTry={[
          "Drag any seam",
          "Note Scratch is absent — it has no panelId",
        ]}
        source={registryListSource}
      >
        <RegistryList />
      </Example>
      <P>
        The snapshot only contains panels that set a <Code>panelId</Code>.
        Anonymous panels stay resizable but never appear &mdash; the{" "}
        <Code>Scratch</Code> panel has no <Code>panelId</Code>, so you can drag
        it yet it is absent from the list. Until the <Code>groupId</Code> is
        published the hook returns a stable empty record, so{" "}
        <Code>Object.entries()</Code> over it is safe on the first render. The
        trade-off is breadth: this hook re-renders when <em>any</em> panel in
        the group changes, heavier than a single <Code>usePanelControls</Code>.
        If you only need one panel, subscribe to that one.
      </P>

      <H2 id="provider-wide-activity">Provider-wide interaction activity</H2>
      <P>
        The three hooks above read panel <em>state</em>.{" "}
        <Code>usePanelInteractionState()</Code> reads interaction{" "}
        <em>activity</em> across the whole provider instead: whether a pointer
        resize session is active anywhere, and whether any group container is
        currently resizing. It takes no locator &mdash; it is not about a
        specific panel. Use it to drive a global affordance, like dimming an
        overlay or suspending expensive work while the user drags.
      </P>
      <Example
        title="Global interaction indicator"
        caption="usePanelInteractionState reports provider-wide drag and container-resize activity with no locator."
        whatToTry={["Drag the seam — the pill lights up", "Release — it idles"]}
        source={interactionIndicatorSource}
      >
        <InteractionIndicator />
      </Example>
      <P>
        It returns <Code>{"{ isPointerDragging, isContainerResizing }"}</Code>.
        Keyboard resizes are atomic value changes, not drag sessions, so they do
        not flip <Code>isPointerDragging</Code>.{" "}
        <Code>isContainerResizing</Code> reflects a group&rsquo;s container
        being resized (observed by the library), not a pointer gesture on a
        handle.
      </P>

      <H2 id="group-size-and-fit">Reading the group&rsquo;s size and fit</H2>
      <P>
        The hooks above read a single panel or the provider&rsquo;s activity.{" "}
        <Code>usePanelGroupState(groupId)</Code> reads the whole group&rsquo;s{" "}
        <em>condition</em> instead: a <Code>PanelGroupState</Code> snapshot with
        the group&rsquo;s measured <Code>containerSize</Code> in px, a{" "}
        <Code>measured</Code> flag (<Code>false</Code> during SSR and the
        pre-measurement first paint), and two shortfalls &mdash;{" "}
        <Code>overconstrainedBy</Code> (px by which the panels&rsquo; floors
        exceed the container) and <Code>unallocatedPx</Code> (px that could not
        be placed without exceeding a maximum). It returns{" "}
        <Code>undefined</Code> until the group publishes its{" "}
        <Code>groupId</Code>, and it is groupId-keyed exactly like{" "}
        <Code>usePanelControls</Code>: an exact match or nothing, never a
        mount-order fallback.
      </P>
      <P>
        This is the hook to breakpoint on the <em>container</em> rather than{" "}
        <Code>window.matchMedia</Code> &mdash; the right measurement for a
        nested group, a group inside a card, or a split view, where the viewport
        is the wrong number. Read <Code>containerSize</Code> and decide when a
        side panel should demote to a sheet, drop to tabs, or collapse. The
        snapshot is equality-gated on its numeric fields, so a seam drag that
        leaves the group&rsquo;s size and fit unchanged re-renders no consumer.
      </P>
      <Example
        title="Responsive swap on containerSize"
        caption="usePanelGroupState reads the pane's measured width; below 420px the list column becomes a top tab strip."
        whatToTry={[
          "Drag the outer seam left",
          "Cross 420px — the list demotes",
          "Widen past 520px — it returns",
        ]}
        source={groupStateSwapSource}
        frameClassName="h-72"
      >
        <GroupStateSwap />
      </Example>
      <Callout title="Two details keep the swap clean">
        A <strong>hysteresis band</strong> &mdash; stack below 420px, split
        above 520px &mdash; stops the layout flapping when the width hovers at
        the breakpoint. And flipping the mode <em>during render</em> (not in an
        effect), gated on <Code>measured</Code>, means the boundary never
        commits a wrong-mode frame. The measured group stays mounted across the
        swap, so <Code>containerSize</Code> keeps updating and a widen restores
        the split.
      </Callout>
      <P>
        When a panel demotes to a sheet it <em>unmounts</em>, so its{" "}
        <strong>layout</strong> state (size, collapsed flag) must be persisted (
        <DocLink to="/docs/persistence">persistence</DocLink>) or held by the
        parent and fed back as <Code>defaultSize</Code> to return on remount,
        and its <strong>content</strong> state (form input, scroll) is best kept
        by mounting the content once under a stable parent and moving only the
        DOM between the inline panel and the sheet. The{" "}
        <DocLink to="/docs/responsive">responsive</DocLink> page walks the whole
        demote-to-sheet pattern end to end.
      </P>

      <H2 id="panelcontrols-fields">PanelControls fields</H2>
      <P>
        <Code>usePanelControls</Code> and each value from{" "}
        <Code>usePanelRegistry</Code> return this shape. It also carries the
        bound actions (<Code>setSize</Code>, <Code>collapse</Code>, and the
        rest) so a control can read and dispatch from one object &mdash; see{" "}
        <DocLink to="/docs/imperative-and-actions">
          the imperative API &amp; actions
        </DocLink>
        .
      </P>
      <Table
        rows={[
          [
            "kind",
            <Code>"docked" | "peer"</Code>,
            "Discriminant. Docked panels also carry side; peers do not. Narrow on this before reading side.",
          ],
          [
            "side",
            <Code>PanelSide</Code>,
            'Present only on the docked arm ("start" | "end"). Which edge the panel is anchored to.',
          ],
          [
            "size",
            <Code>number</Code>,
            "Preferred size in px — what was last requested. Use for a slider's value; changes on every drag frame.",
          ],
          [
            "renderedSize",
            <Code>number</Code>,
            "Actually-displayed size in px. Differs from size while collapsed or clamped. Use to reflect what's on screen.",
          ],
          [
            "collapsed",
            <Code>boolean</Code>,
            "Whether the panel is currently collapsed. If this is all you read, prefer usePanelCollapsed.",
          ],
          [
            "collapsible",
            <Code>boolean</Code>,
            "Whether the panel can collapse at all. Use to hide a collapse toggle that would never apply.",
          ],
          [
            "disabled",
            <Code>boolean</Code>,
            "Whether resizing is disabled. Use to disable your own resize controls in step.",
          ],
          [
            "isReady",
            <Code>boolean</Code>,
            "True once measurement-dependent constraints are authoritative (not placeholders). Does not mean they stop changing.",
          ],
          [
            "constraints",
            <Code>PanelControlConstraints</Code>,
            "Resolved { minSize, maxSize, collapsedSize } in px. The bounds to build a slider or a min/max label from.",
          ],
          [
            "orientation",
            <Code>PanelGroupOrientation</Code>,
            '"horizontal" | "vertical" — the axis of the panel\'s group. Use to lay a control out along the same axis.',
          ],
        ]}
      />
      <P>
        The <Code>constraints</Code> field is three resolved pixel values
        &mdash; no strings, no percentages. Its type,{" "}
        <Code>PanelControlConstraints</Code>, is the live bounds a control UI
        needs; they re-resolve as the container or the panel&rsquo;s props
        change.
      </P>
      <Pre lang="ts">{`type PanelControlConstraints = {
  minSize: number;       // resolved lower bound, px
  maxSize: number;       // resolved upper bound, px
  collapsedSize: number; // rendered size while collapsed, px
};`}</Pre>

      <H2 id="choosing">Choosing a hook</H2>
      <Table
        rows={[
          [
            "usePanelControls",
            <Code>(locator) =&gt; PanelControls | undefined</Code>,
            "One panel's full live state. Re-renders when that panel materially changes (including every drag frame). Use for a single-panel readout or control.",
          ],
          [
            "usePanelCollapsed",
            <Code>(locator) =&gt; boolean | undefined</Code>,
            "Only the collapsed flag. Does not re-render on size drags. Use when your UI reacts to collapse alone.",
          ],
          [
            "usePanelRegistry",
            <Code>(groupId) =&gt; Record&lt;string, PanelControls&gt;</Code>,
            "Every named panel in one group, keyed by panelId. Re-renders when any panel changes. Use for lists of panels, not a single one.",
          ],
          [
            "usePanelInteractionState",
            <Code>
              () =&gt; {"{ isPointerDragging, isContainerResizing }"}
            </Code>,
            "Provider-wide interaction flags, no locator. Use for global drag/resize affordances.",
          ],
          [
            "usePanelGroupState",
            <Code>(groupId) =&gt; PanelGroupState | undefined</Code>,
            "One group's measured containerSize, measured flag, and over-constraint / unallocated shortfalls. Equality-gated. Use to breakpoint on the container — swap to a sheet or tabs — instead of the viewport.",
          ],
        ]}
      />

      <H2 id="gotchas">Gotchas</H2>
      <P>
        <strong>Resolvable, not immediate.</strong> The locator hooks return{" "}
        <Code>undefined</Code> until the group publishes its{" "}
        <Code>groupId</Code> and the panel mounts. Anonymous panels (no{" "}
        <Code>panelId</Code>) and unpublished groups (no <Code>groupId</Code>)
        are never resolvable &mdash; lookup does not fall back across groups.
        Always handle the <Code>undefined</Code> case.
      </P>
      <P>
        <strong>Every hook needs a provider.</strong> All five throw when called
        outside any provider boundary. A standalone <Code>PanelGroup</Code>{" "}
        installs an implicit one for its own subtree, so a component rendered
        inside the group is fine. To read from <em>outside</em> a group &mdash;
        the readouts in these examples sit above the group &mdash; wrap the
        caller and the group in one explicit <Code>PanelProvider</Code>. See{" "}
        <DocLink to="/docs/provider-and-hooks">providers and hooks</DocLink>.
      </P>
      <P>
        <strong>Preferred vs rendered.</strong> If a value looks
        &ldquo;stuck&rdquo; during over-constraint or collapse, you are probably
        reading <Code>size</Code> when you want <Code>renderedSize</Code>, or
        the reverse. <Code>size</Code> is the request; <Code>renderedSize</Code>{" "}
        is the result.
      </P>

      <Related
        items={[
          {
            to: "/docs/imperative-and-actions",
            label: "Imperative API & actions",
            note: "the write side — usePanelActions dispatches without subscribing",
          },
          {
            to: "/docs/provider-and-hooks",
            label: "Providers & hooks",
            note: "how a group publishes a groupId and when you need an explicit provider",
          },
          {
            to: "/docs/responsive",
            label: "Responsive",
            note: "the full demote-to-sheet pattern driven by containerSize",
          },
        ]}
      />
    </div>
  );
}
