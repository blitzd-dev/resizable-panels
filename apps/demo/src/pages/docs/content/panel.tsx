import DefaultCollapsed from "../examples/panel/default-collapsed";
import defaultCollapsedSource from "../examples/panel/default-collapsed.tsx?raw";
import DockedSidebar from "../examples/panel/docked-sidebar";
import dockedSidebarSource from "../examples/panel/docked-sidebar.tsx?raw";
import PeerColumns from "../examples/panel/peer-columns";
import peerColumnsSource from "../examples/panel/peer-columns.tsx?raw";
import PinnedPanel from "../examples/panel/pinned-panel";
import pinnedPanelSource from "../examples/panel/pinned-panel.tsx?raw";
import {
  Code,
  DocLink,
  Example,
  H2,
  Kbd,
  P,
  Pre,
  Related,
  Req,
  Table,
} from "../primitives";

export function PanelDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        <Code>Panel</Code> is the box that holds your content inside a{" "}
        <DocLink to="/docs/panel-group">group</DocLink>. It is one component
        with two modes: give it a <Code>side</Code> and it docks to an edge with
        its own size; leave <Code>side</Code> off and it becomes a peer that
        shares the leftover space.
      </P>

      <Example
        title="Docked sidebar"
        caption="A side prop makes a docked panel that holds its size at the group's edge."
        whatToTry={["Drag the seam", "Widen the group — the sidebar holds"]}
        source={dockedSidebarSource}
      >
        <DockedSidebar />
      </Example>

      <H2 id="props">Props</H2>
      <P>
        Every prop <Code>Panel</Code> accepts. The full type is{" "}
        <Code>PanelProps</Code>, a discriminated union of{" "}
        <Code>DockedPanelProps</Code> and <Code>PeerPanelProps</Code> keyed on{" "}
        <Code>side</Code> — the <Code>side</Code> and <Code>pinned</Code> rows
        exist only on the docked arm. Sizes are{" "}
        <DocLink to="/docs/sizing">
          <Code>SizeSpec</Code>
        </DocLink>{" "}
        values. Collapse props are declared on <Code>Panel</Code> too but
        taught, with their own table, on{" "}
        <DocLink to="/docs/collapsing">collapsing</DocLink>.
      </P>
      <Table
        rows={[
          [
            "panelId",
            <Code>string</Code>,
            <>
              Group-local identity. Set it to key this panel in layout
              snapshots, persistence, per-panel events, and provider lookup.
              Omit for an anonymous panel that still resizes but is invisible to
              those keyed APIs. Must be non-empty.
            </>,
          ],
          [
            "defaultSize",
            <Code>SizeSpec</Code>,
            <>
              Initial size along the group&rsquo;s axis. <Req /> for docked
              panels — a docked panel owns its size, so it must start somewhere.
              Optional for peers: omit to auto-distribute remaining space
              equally among the other unsized peers.
            </>,
          ],
          [
            "minSize",
            <Code>SizeSpec</Code>,
            <>
              Lower bound. Default <Code>0</Code> for peers, <Code>200</Code>{" "}
              for docked panels — a docked panel resists shrinking below 200px
              until you lower this.
            </>,
          ],
          [
            "maxSize",
            <Code>SizeSpec</Code>,
            <>
              Upper bound. Default <Code>"100%"</Code>, so a panel can never
              grow larger than its group on its own. Set it to cap a
              panel&rsquo;s growth.
            </>,
          ],
          [
            "containerResizeBehavior",
            <>
              <Code>"fixed"</Code> | <Code>"proportional"</Code>
            </>,
            <>
              How the panel reacts when the group itself resizes. Default{" "}
              <Code>"fixed"</Code> for docked (keep pixel size),{" "}
              <Code>"proportional"</Code> for peers (keep share). Override for
              the opposite behavior.
            </>,
          ],
          [
            "disabled",
            <Code>boolean</Code>,
            <>
              Prevent resizing this panel — through its own handle and through
              any neighbor cascade. The stronger lock;{" "}
              <DocLink to="#pinned">
                <Code>pinned</Code>
              </DocLink>{" "}
              only blocks cascades.
            </>,
          ],
          [
            "collapsible",
            <>
              <Code>boolean</Code> | <Code>"auto"</Code>
            </>,
            <>
              Whether the panel can collapse. Default <Code>true</Code> for
              docked, <Code>false</Code> for peers. The collapse behaviors —{" "}
              <Code>collapsedSize</Code>, <Code>collapseBelow</Code>,{" "}
              <Code>"auto"</Code> folding, and the rest — live on{" "}
              <DocLink to="/docs/collapsing">collapsing</DocLink>.
            </>,
          ],
          [
            "collapsed",
            <Code>boolean</Code>,
            <>
              Controlled collapsed state. When set, the prop is authoritative
              and every collapse/expand path proposes through{" "}
              <Code>onCollapsedChange</Code> instead of self-applying. Mutually
              exclusive with <Code>defaultCollapsed</Code>; see{" "}
              <DocLink to="#controlled-collapsed">controlled collapsed</DocLink>
              .
            </>,
          ],
          [
            "onSizeChange",
            <Code>(size, details) =&gt; void</Code>,
            <>
              Fires when the panel&rsquo;s committed preferred size changes, in
              pixels (<Code>details</Code> is a <Code>PanelChangeDetails</Code>
              ). Mount-suppressed, and never fired for incidental renders or
              animation frames.
            </>,
          ],
          [
            "onCollapsedChange",
            <Code>(collapsed, details) =&gt; void</Code>,
            <>
              Fires when the committed collapsed state changes, in either
              direction. Mount-suppressed. With a controlled{" "}
              <Code>collapsed</Code> prop this becomes the proposal channel
              instead.
            </>,
          ],
          [
            "apiRef",
            <Code>Ref&lt;PanelApi&gt;</Code>,
            <>
              Imperative controller for this panel — <Code>setSize</Code>,{" "}
              <Code>collapse</Code>, and getters. See the{" "}
              <DocLink to="/docs/imperative-and-actions">
                imperative API
              </DocLink>
              . The normal React <Code>ref</Code> points at the root{" "}
              <Code>div</Code>.
            </>,
          ],
          [
            "slotProps",
            <Code>PanelSlots</Code>,
            <>
              Props for the panel&rsquo;s internal viewport and content
              elements, for the rare case you need to style or attribute them.
              Covered on{" "}
              <DocLink to="/docs/styling-and-slot-props">
                styling &amp; slot props
              </DocLink>
              .
            </>,
          ],
          [
            "side",
            <Code>PanelSide</Code>,
            <>
              <em>Docked-only.</em> The logical edge to anchor to —{" "}
              <Code>"start"</Code> or <Code>"end"</Code>. Follows the
              group&rsquo;s <Code>dir</Code>, so it maps to the correct physical
              edge in right-to-left layouts. Its presence is what makes a panel
              docked.
            </>,
          ],
          [
            "pinned",
            <Code>boolean</Code>,
            <>
              <em>Docked-only.</em> Default <Code>false</Code>. Excludes the
              panel from sibling drag cascades — no neighbor&rsquo;s handle can
              shrink it, while its own handle still resizes it. See{" "}
              <DocLink to="#pinned">pinned panels</DocLink>.
            </>,
          ],
          [
            "className / style / children / div attrs",
            <Code>—</Code>,
            <>
              Applied to the panel&rsquo;s root <Code>div</Code>.{" "}
              <Code>onResize</Code> is the one native attribute a panel does not
              accept — reach for <Code>onSizeChange</Code> instead, which
              reports the panel&rsquo;s own size rather than a DOM resize event.
            </>,
          ],
        ]}
      />

      <H2 id="docked-vs-peer">Docked vs peer</H2>
      <P>
        The presence of <Code>side</Code> is the only thing that decides a
        panel&rsquo;s mode, and it flips several defaults at once — so
        don&rsquo;t assume a value carries across modes. A{" "}
        <strong>docked</strong> panel anchors to one edge (<Code>"start"</Code>{" "}
        or <Code>"end"</Code>), owns a fixed size (<Code>defaultSize</Code> is
        required), and defaults to collapsible. A <strong>peer</strong> panel
        has no <Code>side</Code>: peers divide the remaining space among
        themselves, and a peer without a <Code>defaultSize</Code>{" "}
        auto-distributes an equal share.
      </P>
      <Example
        title="Peer columns"
        caption="Peers have no side, so they divide the remaining space among themselves."
        whatToTry={["Drag each seam", "Unsized peers stay equal"]}
        source={peerColumnsSource}
      >
        <PeerColumns />
      </Example>
      <P>
        The public prop type is a discriminated union you rarely name directly,
        but it is there when you need it. The type system enforces the split:{" "}
        <Code>side</Code> and <Code>pinned</Code> exist only on{" "}
        <Code>DockedPanelProps</Code>, where <Code>defaultSize</Code> is also
        required; a <Code>PeerPanelProps</Code> rejects <Code>side</Code> and{" "}
        <Code>pinned</Code> and treats <Code>defaultSize</Code> as optional —
        omit it to auto-distribute.
      </P>
      <Pre lang="ts">{`type PanelProps = DockedPanelProps | PeerPanelProps;
// DockedPanelProps: has side + required defaultSize, allows pinned
// PeerPanelProps:   no side, no pinned; defaultSize optional
type PanelSide = "start" | "end";`}</Pre>

      <H2 id="sizing">Sizing bounds</H2>
      <P>
        A panel&rsquo;s size is a <Code>defaultSize</Code> clamped between{" "}
        <Code>minSize</Code> and <Code>maxSize</Code>, every one a{" "}
        <Code>SizeSpec</Code> — a number is pixels, a string carries its own
        unit. The defaults differ by mode: <Code>minSize</Code> is{" "}
        <Code>0</Code> for peers and <Code>200</Code> for docked panels, and{" "}
        <Code>maxSize</Code> is <Code>"100%"</Code> for both.{" "}
        <Code>containerResizeBehavior</Code> then decides what happens to that
        size when the group itself grows or shrinks. The full grammar —
        percentages, <Code>calc()</Code>, and how bounds resolve — lives on{" "}
        <DocLink to="/docs/sizing">sizing</DocLink>.
      </P>

      <H2 id="pinned">Pinned panels</H2>
      <P>
        By default, when neighbors run out of room a drag can cascade through
        them and shrink a docked panel that was not the one being dragged.
        Marking a docked panel <Code>pinned</Code> takes it out of those
        cascades: no neighbor&rsquo;s handle can shrink it, while its own handle
        keeps working. Drag the seam between the two peers far toward the
        sidebar — unpinned, the sidebar starts giving up width once{" "}
        <Code>Peer one</Code> is exhausted; pinned, it holds.
      </P>
      <Example
        title="Pinned sidebar"
        caption="A pinned docked panel is excluded from neighbor cascades, so it holds its width."
        whatToTry={[
          "Drag the peer seam inward",
          "Toggle pinned, then drag again",
        ]}
        source={pinnedPanelSource}
      >
        <PinnedPanel />
      </Example>
      <P>
        <Code>pinned</Code> is docked-only. Setting it on a peer emits a dev
        warning and has no effect. It is the softer of the two locks;{" "}
        <Code>disabled</Code> freezes a panel&rsquo;s size entirely — through
        its own handle and through any cascade.
      </P>

      <H2 id="collapsing">Collapsing</H2>
      <P>
        Docked panels are collapsible by default; peers are not until you set{" "}
        <Code>collapsible</Code>. The collapse props —{" "}
        <Code>defaultCollapsed</Code>, <Code>collapsedSize</Code>,{" "}
        <Code>collapseBelow</Code>, <Code>resizableWhenCollapsed</Code>,{" "}
        <Code>collapseBelowHysteresis</Code>, and the{" "}
        <Code>PanelCollapseBelowBehavior</Code> that picks the closing motion —
        are declared here but taught, with their own table and live examples, on{" "}
        <DocLink to="/docs/collapsing">collapsing</DocLink>. Setting any of them
        while <Code>collapsible={"{false}"}</Code> warns and is ignored.
      </P>
      <P>
        The one you can meet in isolation is <Code>defaultCollapsed</Code>: it
        seeds a collapsible panel&rsquo;s initial collapsed state once, then
        hands ownership back to the panel. Pair it with a non-zero{" "}
        <Code>collapsedSize</Code> to start folded to a rail.
      </P>
      <Example
        title="Start collapsed"
        caption="defaultCollapsed seeds the initial state; the panel opens to 220px on toggle."
        whatToTry={[
          "Reload — it starts folded",
          "Toggle it open",
          "Drag the collapsed rail",
        ]}
        source={defaultCollapsedSource}
      >
        <DefaultCollapsed />
      </Example>

      <H2 id="controlled-collapsed">Controlled collapsed</H2>
      <P>
        A collapsible panel owns its collapsed state by default, seeded once by{" "}
        <Code>defaultCollapsed</Code>. To drive that state from your own app
        state, pass a controlled <Code>collapsed</Code> boolean instead. The
        panel then renders whatever you pass, and every collapse or expand path
        — a button, <Kbd>Enter</Kbd> on the handle, a drag past{" "}
        <Code>collapseBelow</Code>, group commands — emits a proposal through{" "}
        <Code>onCollapsedChange</Code> rather than applying itself. It is
        mutually exclusive with <Code>defaultCollapsed</Code> and inert on a
        non-collapsible panel. The full contract and a live example live on{" "}
        <DocLink to="/docs/controlled-state">controlled state</DocLink>.
      </P>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        A docked <Code>{"<Panel side>"}</Code> without a{" "}
        <Code>defaultSize</Code> warns and degrades its layout — always supply
        one. <Code>pinned</Code> on a peer warns and does nothing, as do
        collapse props on a non-collapsible panel. A blank <Code>panelId</Code>{" "}
        warns; omit it entirely for an anonymous panel. And a few style keys on{" "}
        <Code>slotProps</Code> belong to the library and win over anything you
        pass — see{" "}
        <DocLink to="/docs/styling-and-slot-props">
          styling &amp; slot props
        </DocLink>
        .
      </P>

      <Related
        items={[
          {
            to: "/docs/building-layouts",
            label: "Building layouts",
            note: "compose docked and peer panels into real UIs",
          },
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: "the collapse props declared here",
          },
          {
            to: "/docs/component-props",
            label: "Components & props",
            note: "PanelProps, PanelSlots, and the full type surface",
          },
        ]}
      />
    </div>
  );
}
