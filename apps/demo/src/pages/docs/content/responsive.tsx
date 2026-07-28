import OwnedCollapse from "../examples/responsive/owned-collapse";
import ownedCollapseSource from "../examples/responsive/owned-collapse.tsx?raw";
import PauseDuringResize from "../examples/responsive/pause-during-resize";
import pauseDuringResizeSource from "../examples/responsive/pause-during-resize.tsx?raw";
import ResponsiveOrientation from "../examples/responsive/responsive-orientation";
import responsiveOrientationSource from "../examples/responsive/responsive-orientation.tsx?raw";
import { Callout, Code, DocLink, Example, H2, P, Related } from "../primitives";

export function ResponsiveDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        The same layout ships to a phone and a desktop. There is no separate
        mobile component and no built-in breakpoint system &mdash; responsive
        behavior lives in your own app code and feeds into props the group and
        panels already expose. This page is the map: swap the layout axis at a
        breakpoint, collapse a sidebar when space runs out, and pause expensive
        work while a resize is in flight. Each underlying prop is taught in full
        on the page that owns it; here you get the responsive recipe and a link.
      </P>

      <H2 id="orientation">Swap orientation at a breakpoint</H2>
      <P>
        A desktop split runs left-to-right; on a narrow screen the same two
        regions read better stacked. Because{" "}
        <DocLink to="/docs/panel-group">
          <Code>orientation</Code>
        </DocLink>{" "}
        is an ordinary <Code>PanelGroup</Code> prop, this is plain React:
        measure the available width, pick <Code>"horizontal"</Code> or{" "}
        <Code>"vertical"</Code>, and pass it in. The decision lives in your
        component, not in the library &mdash; a <Code>ResizeObserver</Code> or a
        window <Code>matchMedia</Code> query drives it exactly the same way.
      </P>
      <Example
        title="Horizontal on wide, vertical on narrow"
        caption="A ResizeObserver flips orientation at ~520px — the decision lives in your component."
        whatToTry={[
          "Drag the frame corner past ~520px",
          "Watch the split become a stack",
          "Drag along the new axis",
        ]}
        source={responsiveOrientationSource}
        frameClassName="h-72"
      >
        <ResponsiveOrientation />
      </Example>
      <P>
        Nothing else has to change when the axis flips. A docked panel&rsquo;s{" "}
        <Code>side</Code> is logical, so a <Code>side="start"</Code> sidebar
        docks left when horizontal and to the top when vertical. A bare{" "}
        <Code>PanelResizeHandle</Code> orients its seam with the group. Only a{" "}
        <em>custom</em> handle you style yourself needs axis-aware CSS &mdash;
        see <DocLink to="/docs/panel-resize-handle">resize handles</DocLink>.
      </P>

      <H2 id="auto-collapse">Collapse a sidebar when space runs out</H2>
      <P>
        For the common case &mdash; fold a sidebar to a rail the moment its{" "}
        <Code>minSize</Code> stops fitting &mdash; you write none of this.{" "}
        <Code>collapsible="auto"</Code> does it from the container width alone,
        with no <Code>matchMedia</Code> and no breakpoint math. It is taught in
        full under <DocLink to="/docs/collapsing">collapsing</DocLink>; reach
        for it first.
      </P>
      <P>
        Own the collapse yourself when your policy differs &mdash; a threshold
        that is not just &ldquo;the minimum stopped fitting&rdquo;, a demotion
        to an overlay sheet instead of a rail, or work you want to pause before
        folding. Drive the panel from your own width-watching code through its{" "}
        <DocLink to="/docs/imperative-and-actions">
          <Code>apiRef</Code>
        </DocLink>{" "}
        (call <Code>collapse()</Code> / <Code>expand()</Code>), or dispatch{" "}
        <Code>setCollapsed</Code> from <Code>usePanelActions</Code>. The example
        watches its own width with a <Code>ResizeObserver</Code> and collapses
        the sidebar under 480px.
      </P>
      <Example
        title="App-owned collapse under 480px"
        caption="A ResizeObserver drives apiRef.collapse()/expand() — your width policy, the panel's mechanism."
        whatToTry={[
          "Drag the frame corner below ~480px",
          "Watch the sidebar collapse",
          "Widen again to expand it",
        ]}
        source={ownedCollapseSource}
      >
        <OwnedCollapse />
      </Example>
      <Callout title="An app-owned collapse is a normal collapse">
        Driving <Code>collapse()</Code> yourself goes through the same path as a
        button or a drag: the panel animates, gains{" "}
        <Code>data-state="collapsed"</Code>, and leaves the tab order at a zero{" "}
        <Code>collapsedSize</Code>. Only <Code>collapsible="auto"</Code> adds
        the <Code>data-auto-collapsed</Code> marker and the non-persisting
        behavior &mdash; a collapse you drive is a real, saved state.
      </Callout>

      <H2 id="pause-work">Pause expensive work while resizing</H2>
      <P>
        A chart or a virtualized list should not recompute on every intermediate
        frame of a drag. <Code>usePanelInteractionState()</Code> reports two
        provider-wide flags &mdash; <Code>isPointerDragging</Code> (a pointer
        resize is in progress) and <Code>isContainerResizing</Code> (a group
        container is being resized). While either is true, render a cheap
        placeholder; when the gesture settles, swap the real content back in.
      </P>
      <Example
        title="Placeholder mid-gesture"
        caption="While a resize flag is set the panel renders a stub instead of recomputing the chart."
        whatToTry={[
          "Drag the seam — content pauses",
          "Drag the frame corner — same pause",
          "Release to recompute",
        ]}
        source={pauseDuringResizeSource}
      >
        <PauseDuringResize />
      </Example>
      <P>
        The hook must run inside a provider. A standalone{" "}
        <Code>PanelGroup</Code> installs an implicit one, and any descendant
        &mdash; like the chart above &mdash; resolves it. A caller{" "}
        <em>outside</em> the group (a sibling toolbar, a width-watcher that
        renders the group) is not in that subtree, so it throws:{" "}
        <Code>
          usePanelInteractionState must be used inside a &lt;PanelGroup&gt;
          (which provides an implicit boundary) or a &lt;PanelProvider&gt;
        </Code>
        . Wrap both the caller and the group in one{" "}
        <DocLink to="/docs/provider-and-hooks">
          <Code>PanelProvider</Code>
        </DocLink>{" "}
        to share the boundary. The hook sits alongside the other read hooks on{" "}
        <DocLink to="/docs/reading-state">reading state</DocLink>.
      </P>

      <H2 id="container-resize">React to a resizing container</H2>
      <P>
        Rotating a device, entering split view, or dragging a side sheet resizes
        the group&rsquo;s container, and each panel decides how to absorb the
        change through <Code>containerResizeBehavior</Code>. The defaults
        already match most intent, so this is a knob you reach for only when
        rotation or split view should give a panel the other behavior. It is
        taught with the rest of the size grammar on{" "}
        <DocLink to="/docs/sizing">sizing</DocLink>.
      </P>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        Keep responsive <em>visibility</em> in your own code. This library
        resizes and collapses panels; it does not remove a region at a
        breakpoint for you. If a panel should disappear entirely on mobile
        rather than collapse to a rail, conditionally render it &mdash; or its
        whole group &mdash; from your component, the same way you would any
        other responsive UI.
      </P>
      <P>
        Two standalone sibling groups get independent implicit providers and
        cannot see each other&rsquo;s interaction flags. A toolbar or
        width-watcher that lives beside a group, and any cross-group lookup,
        needs a shared explicit <Code>PanelProvider</Code> wrapping both.
      </P>

      <Related
        items={[
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: 'collapsible="auto", rails, and drag-to-collapse thresholds',
          },
          {
            to: "/docs/sizing",
            label: "Sizing",
            note: "containerResizeBehavior in depth and how sizes track a resizing container",
          },
          {
            to: "/docs/reading-state",
            label: "Reading state",
            note: "usePanelInteractionState alongside the other read hooks",
          },
          {
            to: "/docs/panel-group",
            label: "Panel group",
            note: "the orientation prop and a manual orientation toggle",
          },
        ]}
      />
    </div>
  );
}
