import Anatomy from "../examples/mental-model/anatomy";
import anatomySource from "../examples/mental-model/anatomy.tsx?raw";
import DockedPanelWithPeers from "../examples/mental-model/docked-panel-with-peers";
import dockedPanelWithPeersSource from "../examples/mental-model/docked-panel-with-peers.tsx?raw";
import PeerPanels from "../examples/mental-model/peer-panels";
import peerPanelsSource from "../examples/mental-model/peer-panels.tsx?raw";
import {
  Callout,
  Code,
  DocLink,
  Example,
  H2,
  P,
  Related,
  Table,
} from "../primitives";

export function MentalModelDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        This library has three building blocks and one distinction between two
        kinds of panel. This page is the map: read it once and the rest of the
        docs &mdash; every prop table, every hook &mdash; slots into place.
      </P>

      <H2 id="anatomy">The three pieces</H2>
      <P>
        Every layout is built from the same three components. Drag either seam
        in the layout below, then read the labels.
      </P>
      <Example
        title="Group, panel, and handle"
        caption="A PanelGroup holds Panels split by a PanelResizeHandle between each pair."
        whatToTry={["Drag either seam", "Read the panel labels"]}
        source={anatomySource}
      >
        <Anatomy />
      </Example>
      <P>
        A <Code>PanelGroup</Code> is the container. It picks one axis &mdash;{" "}
        <Code>orientation="horizontal"</Code> or <Code>"vertical"</Code> &mdash;
        and divides its space along it. Everything else lives inside a group;
        the full container contract is on the{" "}
        <DocLink to="/docs/panel-group">PanelGroup</DocLink> page.
      </P>
      <P>
        A <Code>Panel</Code> is one resizable region. A group holds two or more
        of them. Each panel is a box you put your own content into; the library
        owns its width or height.
      </P>
      <P>
        A <Code>PanelResizeHandle</Code> is the draggable seam. It sits{" "}
        <em>directly between two panels</em>, as their sibling, and moving it
        resizes the panel on each side. A group with three panels has two
        handles, one at each boundary.
      </P>

      <H2 id="docked-vs-peer">Docked panels and peer panels</H2>
      <P>
        Panels come in two kinds, and one prop decides which: <Code>side</Code>.
        Give a panel a <Code>side</Code> and it is <em>docked</em> &mdash; it
        anchors to an edge of the group and owns its own size. Leave{" "}
        <Code>side</Code> off and the panel is a <em>peer</em> &mdash; it shares
        whatever space is left with the other peers, proportionally.
      </P>
      <Example
        title="Three peer panels"
        caption="Peers carry no side, so they split the width evenly and scale proportionally when the container resizes."
        whatToTry={["Drag a seam", "Two peers trade width"]}
        source={peerPanelsSource}
      >
        <PeerPanels />
      </Example>
      <P>
        With no <Code>side</Code>, all three panels are peers. They split the
        width evenly &mdash; a peer with no <Code>defaultSize</Code>{" "}
        auto-distributes an equal share &mdash; and scale proportionally when
        the container resizes. Dragging a seam is a different move: it resizes
        the two peers on either side of that boundary, which trade width, while
        the rest hold.
      </P>
      <Example
        title="One docked panel + two peers"
        caption='A side="start" panel holds a fixed edge while the peers divide the rest.'
        whatToTry={[
          "Drag the sidebar seam",
          "Drag the peer seam — the dock holds",
        ]}
        source={dockedPanelWithPeersSource}
      >
        <DockedPanelWithPeers />
      </Example>
      <P>
        The first panel now adds <Code>side="start"</Code>. It holds a fixed
        200px edge while the two peers to its right divide the rest. That one
        prop is the whole difference.
      </P>
      <P>
        This kind &mdash; <Code>"docked"</Code> or <Code>"peer"</Code> &mdash;
        is the <Code>PanelKind</Code> type. It is the one piece of vocabulary
        this page owns; you will see it name behavior throughout the rest of the
        docs.
      </P>
      <Table
        headers={["PanelKind", "Condition", "Behavior"]}
        rows={[
          [
            '"docked"',
            <>
              panel has a <Code>side</Code>
            </>,
            <>
              Anchors to a group edge and owns its own size. Requires{" "}
              <Code>defaultSize</Code>. Use for a sidebar, inspector, or any
              region that should keep a stable width.
            </>,
          ],
          [
            '"peer"',
            <>
              panel has no <Code>side</Code>
            </>,
            <>
              Shares leftover space proportionally with adjacent peers. Use for
              the main content columns that should flex to fill the group.
            </>,
          ],
        ]}
      />
      <P>
        Because <Code>side</Code> flips the kind, it also flips several defaults
        &mdash; a docked panel is collapsible and keeps a fixed size when the
        container resizes; a peer is neither, and grows proportionally instead.
        The full prop tables live on the{" "}
        <DocLink to="/docs/panel">Panel</DocLink> page, and{" "}
        <DocLink to="/docs/building-layouts">Building layouts</DocLink> puts the
        two kinds to work. Here it is enough to know the two kinds exist and how
        you choose between them.
      </P>

      <H2 id="preferred-vs-rendered">Preferred size vs rendered size</H2>
      <P>
        A panel tracks two sizes, and keeping them apart avoids confusion later.
        The <em>preferred</em> size is what you asked for &mdash; the{" "}
        <Code>defaultSize</Code> you set, or the size the user last dragged to.
        The <em>rendered</em> size is what actually fits on screen right now.
      </P>
      <P>
        They usually match. They diverge when something overrides the request: a
        collapsed panel renders at its <Code>collapsedSize</Code> while its
        preferred size waits, remembered, for when it reopens; and a panel
        squeezed by a small container renders smaller than it prefers. This is
        why the size readouts distinguish the two &mdash; <Code>getSize()</Code>{" "}
        reports the preferred value, <Code>getRenderedSize()</Code> the
        displayed one, and the reactive{" "}
        <DocLink to="/docs/reading-state">controls hook</DocLink> exposes both.
        When you reach the <DocLink to="/docs/sizing">Sizing</DocLink> page,
        that split is already in your head.
      </P>
      <Callout title="Why the distinction matters">
        A saved layout stores <em>preferred</em> sizes, so a panel reopens at
        the width the user chose even after the window was narrow enough to
        squeeze it. Read the rendered size only when you need what is on screen
        this frame &mdash; a canvas to size, an overflow to detect.
      </Callout>

      <H2 id="identity">Identity: panelId and groupId</H2>
      <P>
        Two optional names give the layout a stable address.{" "}
        <Code>groupId</Code> publishes a <Code>PanelGroup</Code> as a lookup
        namespace; <Code>panelId</Code> names a <Code>Panel</Code> within its
        immediate group. A <Code>panelId</Code> keys the panel&rsquo;s stored
        size, its persistence entry, its per-panel events, and &mdash; paired
        with the group&rsquo;s <Code>groupId</Code> &mdash; provider lookup from
        hooks and the imperative dispatcher.
      </P>
      <P>
        Both are optional. A panel with no <Code>panelId</Code> is{" "}
        <em>anonymous</em>: it stays fully resizable, but it never appears in
        the group value and cannot be addressed by name &mdash; identity is what
        makes a panel controllable and persistable, not what makes it work. A
        group with no <Code>groupId</Code> works too, but stays private to its
        own subtree. Name only the panels you need to reach; leave the rest
        anonymous. (An empty-string <Code>panelId</Code> or <Code>groupId</Code>{" "}
        is a mistake, not an anonymous panel, and warns in development.)
      </P>
      <Callout title="Order is not identity">
        A group value is keyed by <Code>panelId</Code>, never by position, and
        key order carries no meaning &mdash; your React children own the visual
        order. That is why lookup is always by explicit name: mount order can
        never silently decide which panel an action targets.
      </Callout>

      <H2 id="implicit-provider">Why a lone group needs no provider</H2>
      <P>
        You will meet <Code>PanelProvider</Code> later. You do not need it to
        start. A standalone <Code>PanelGroup</Code> installs its own provider
        behind the scenes, so a single group &mdash; like every example on this
        page &mdash; works with no wrapper. The nearest provider wins, so a
        nested group reuses the outer boundary while two standalone sibling
        groups each get their own.
      </P>
      <P>
        You add an explicit <Code>PanelProvider</Code> only when something{" "}
        <em>outside</em> a group needs to reach in &mdash; an external toolbar
        driving a panel, or two sibling groups that should share one lookup
        namespace, since a locator never falls back across providers. Until
        then, the group is self-contained. The{" "}
        <DocLink to="/docs/provider-and-hooks">Provider &amp; hooks</DocLink>{" "}
        page covers those cases.
      </P>

      <P>
        That is the whole model: a <Code>PanelGroup</Code> holds{" "}
        <Code>Panel</Code>s divided by <Code>PanelResizeHandle</Code>s, each
        panel is docked or a peer, sizes come in preferred and rendered, names
        make panels addressable, and a lone group is self-contained. Now meet
        the pieces in detail.
      </P>

      <Related
        items={[
          {
            to: "/docs/building-layouts",
            label: "Building layouts",
            note: "put docked and peer panels to work",
          },
          {
            to: "/docs/panel-group",
            label: "PanelGroup",
            note: "the container and every prop it takes",
          },
          {
            to: "/docs/panel",
            label: "Panel",
            note: "docked vs peer defaults, sizing, and collapse",
          },
        ]}
      />
    </div>
  );
}
