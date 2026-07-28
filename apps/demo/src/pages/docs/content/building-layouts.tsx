import Disabled from "../examples/building-layouts/disabled";
import disabledSource from "../examples/building-layouts/disabled.tsx?raw";
import DockedSidebar from "../examples/building-layouts/docked-sidebar";
import dockedSidebarSource from "../examples/building-layouts/docked-sidebar.tsx?raw";
import PeerColumns from "../examples/building-layouts/peer-columns";
import peerColumnsSource from "../examples/building-layouts/peer-columns.tsx?raw";
import PinnedPanel from "../examples/building-layouts/pinned-panel";
import pinnedPanelSource from "../examples/building-layouts/pinned-panel.tsx?raw";
import { Callout, Code, DocLink, Example, H2, P, Related } from "../primitives";

export function BuildingLayoutsDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        Real layouts are a handful of patterns composed from{" "}
        <Code>PanelGroup</Code> and <Code>Panel</Code>: a sidebar docked to an
        edge, peer columns splitting the rest, groups nested into a grid, and a
        panel or two held out of the resize cascade. This page assembles them.
        The props behind each pattern are taught on the pages that own them —{" "}
        <DocLink to="/docs/panel">Panel</DocLink> and{" "}
        <DocLink to="/docs/sizing">Sizing</DocLink> — so here the focus is the
        shape, not the prop list.
      </P>

      <H2 id="docked-sidebar">Dock a sidebar to an edge</H2>
      <P>
        Give a <Code>Panel</Code> a <Code>side</Code> and it becomes{" "}
        <em>docked</em>: it anchors to one edge of the group and owns a fixed
        size, so <Code>defaultSize</Code> is required. <Code>"start"</Code> is
        the leading edge, <Code>"end"</Code> the trailing one — both follow the
        group&rsquo;s <Code>dir</Code>, so they land on the correct physical
        side in right-to-left layouts. A docked panel holds its width when the
        group resizes and resists shrinking below its <Code>minSize</Code>{" "}
        (default <Code>200</Code>px for docked panels).
      </P>
      <Example
        title="Docked sidebar"
        caption="A side prop anchors the panel to the group's edge; it holds its width while the peer beside it flexes."
        whatToTry={[
          "Drag the seam — the peer flexes, sidebar holds",
          "Widen the frame — the sidebar stays put",
        ]}
        source={dockedSidebarSource}
      >
        <DockedSidebar />
      </Example>

      <H2 id="peer-columns">Let peers share the rest</H2>
      <P>
        Leave <Code>side</Code> off and a <Code>Panel</Code> is a <em>peer</em>.
        Peers divide whatever space the docked panels leave. A peer with a{" "}
        <Code>defaultSize</Code> starts at that size; peers without one
        auto-distribute the remaining space equally among the other unsized
        peers. Mix the two to pin one column&rsquo;s starting width and let the
        rest fill around it — no explicit math, no leftover-tracking.
      </P>
      <Example
        title="Peer columns"
        caption="Two unsized peers split the leftover space equally around one peer seeded at 40%."
        whatToTry={[
          "Drag a seam — neighbors give and take",
          "Reset — the two auto peers land equal",
        ]}
        source={peerColumnsSource}
      >
        <PeerColumns />
      </Example>
      <P>
        Sizes here are <DocLink to="/docs/sizing">SizeSpec</DocLink> values — a
        bare number is pixels, a string carries its own unit (<Code>"40%"</Code>
        , <Code>"12rem"</Code>). Distribution is driven by{" "}
        <Code>defaultSize</Code> presence alone, so omitting it is the
        deliberate way to say &ldquo;share the rest.&rdquo;
      </P>

      <H2 id="nesting">Nest a group into the grid</H2>
      <P>
        The last pattern nests one of these layouts inside another: drop a
        vertical group into a peer of the horizontal group and the docked
        sidebar, peer split, and a stacked editor over a terminal assemble into
        the familiar IDE grid. Nesting is how you get two independent drag axes
        inside a single grid. The mechanics — each group is its own boundary, so
        a drag redistributes space only within the group that owns the handle —
        are taught with a worked example on{" "}
        <DocLink to="/docs/panel-group">PanelGroup</DocLink>.
      </P>

      <H2 id="pinned">Pin a panel out of the cascade</H2>
      <P>
        By default, when a neighbor runs out of room a drag <em>cascades</em>{" "}
        through it and starts shrinking the panel beyond — including a docked
        one that was not the panel being dragged. Marking a docked panel{" "}
        <Code>pinned</Code> excludes it from those sibling cascades: no other
        panel&rsquo;s handle can ever shrink it, while its own handle still
        resizes it normally. Drag the seam between the two peers all the way in
        — an unpinned sidebar would eventually give up width, but this pinned
        one holds.
      </P>
      <Example
        title="Pinned sidebar"
        caption="A pinned docked panel is skipped by sibling cascades, so a neighbor's drag can never steal its width."
        whatToTry={[
          "Drag the peer seam left — the sidebar holds",
          "Drag the sidebar's own handle — it still resizes",
        ]}
        source={pinnedPanelSource}
      >
        <PinnedPanel />
      </Example>
      <P>
        <Code>pinned</Code> is docked-only. Setting it on a peer emits a dev
        warning — <Code>Peer &lt;Panel&gt; components cannot use pinned</Code> —
        and has no effect.
      </P>

      <H2 id="disabled">Disable a panel or a group</H2>
      <P>
        <Code>disabled</Code> is the stronger lock. Where <Code>pinned</Code>{" "}
        only blocks <em>neighbor</em> cascades, a <Code>disabled</Code> panel
        cannot be resized at all — not through its own handle, and not through a
        cascade. It is also a hard barrier: a drag cannot borrow space from
        panels on the far side of it. To freeze an entire layout at once, set{" "}
        <Code>disabled</Code> on the <Code>PanelGroup</Code> instead — it turns
        off pointer, keyboard, collapse-toggle, and reset for every handle in
        the group.
      </P>
      <Example
        title="Disabled panel vs disabled group"
        caption="Lock the middle panel and it becomes an immovable barrier; lock the group and every handle goes dead."
        whatToTry={[
          "Lock middle — its seams and cascades freeze",
          "Lock all — no handle in the group responds",
        ]}
        source={disabledSource}
      >
        <Disabled />
      </Example>
      <Callout title="Pinned vs disabled">
        Reach for <Code>pinned</Code> when a panel should keep its size but stay
        directly resizable — a sidebar that resists neighbor pushes. Reach for{" "}
        <Code>disabled</Code> to freeze a panel outright, or set it on the group
        to lock the whole layout.
      </Callout>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        A docked <Code>&lt;Panel side&gt;</Code> without a{" "}
        <Code>defaultSize</Code> warns (
        <Code>A docked &lt;Panel side&gt; requires defaultSize</Code>) and
        degrades its layout — always supply one. A <Code>disabled</Code> panel
        is a cascade barrier, so a neighbor&rsquo;s drag stops at it rather than
        reaching through to panels beyond; if a cascade seems to &ldquo;run out
        of room&rdquo; early, check for a disabled panel in the path. And peers
        with no <Code>defaultSize</Code> share space equally — to bias the
        split, seed one peer&rsquo;s <Code>defaultSize</Code> rather than sizing
        all of them.
      </P>

      <Related
        items={[
          {
            to: "/docs/sizing",
            label: "Sizing",
            note: "the SizeSpec grammar, min/max bounds, and container resize",
          },
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: "let a docked sidebar tuck away to nothing or a rail",
          },
          {
            to: "/docs/panel",
            label: "Panel",
            note: "every docked and peer prop used on this page",
          },
        ]}
      />
    </div>
  );
}
