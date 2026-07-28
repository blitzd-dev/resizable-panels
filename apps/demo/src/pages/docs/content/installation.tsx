import { InstallTabs } from "@/components/install-tabs";
import FirstSplit from "../examples/installation/first-split";
import firstSplitSource from "../examples/installation/first-split.tsx?raw";
import { Code, DocLink, Example, H2, P, Pre, Related } from "../primitives";

export function InstallationDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        <Code>@blitzd/resizable-panels</Code> gives you draggable, resizable
        panel layouts for React. This page installs the package and gets a
        working two-panel split on screen from three components.
      </P>

      <H2 id="install">Install</H2>
      <P>Add the package with your package manager of choice:</P>
      <InstallTabs pkg="@blitzd/resizable-panels" />
      <P>
        That is the only dependency. There is no stylesheet to import and no
        context provider to wire up first — a single <Code>PanelGroup</Code>{" "}
        installs its own provider and works on its own.
      </P>

      <H2 id="first-split">Your first split</H2>
      <P>
        A layout is three pieces. Start with a <Code>PanelGroup</Code>: it sets
        the axis and holds everything.
      </P>
      <Pre>{`<PanelGroup orientation="horizontal">
</PanelGroup>`}</Pre>
      <P>
        Drop two <Code>Panel</Code>s inside it. With no other props they are{" "}
        <em>peers</em> — they split the group&rsquo;s space evenly and stay
        proportional as it resizes.
      </P>
      <Pre>{`<PanelGroup orientation="horizontal">
  <Panel>Left</Panel>
  <Panel>Right</Panel>
</PanelGroup>`}</Pre>
      <P>
        Finally, put one <Code>PanelResizeHandle</Code> between them, as their
        direct sibling. That handle is the seam you drag.
      </P>
      <Example
        title="A draggable two-panel split"
        caption="A PanelGroup, two Panels, and one handle between them make a resizable split."
        whatToTry={[
          "Drag the seam between the panels",
          "Watch both sides stay proportional",
        ]}
        source={firstSplitSource}
      >
        <FirstSplit />
      </Example>
      <P>
        Drag the seam and the panels grow and shrink to share the group&rsquo;s
        width. That is the whole idea: the group divides its space, and each
        handle moves the boundary between the panels on either side of it.
      </P>

      <H2 id="orientation">Orientation sets the axis</H2>
      <P>
        <Code>orientation</Code> is the one prop <Code>PanelGroup</Code>{" "}
        requires. <Code>"horizontal"</Code> lays panels left-to-right with a
        vertical handle you drag sideways; <Code>"vertical"</Code> stacks them
        top-to-bottom with a horizontal handle you drag up and down.{" "}
        <DocLink to="/docs/panel-group">PanelGroup</DocLink> covers the rest of
        the container&rsquo;s behavior.
      </P>

      <H2 id="handle-placement">The handle is a direct sibling</H2>
      <P>
        A <Code>PanelResizeHandle</Code> must sit as a direct child of the
        group, directly between the two panels it separates — not wrapped in
        another element. Wrap a panel or handle in a <Code>&lt;div&gt;</Code>{" "}
        and that wrapper becomes the flex child the group sizes, so the sizing
        never reaches the panel and the seam breaks.
      </P>

      <H2 id="sized-parent">Give the group a sized parent</H2>
      <P>
        The group fills its parent — it forces its own <Code>width</Code> and{" "}
        <Code>height</Code> to <Code>100%</Code> — so the parent needs a
        definite size along the main axis. Put that size on a wrapping element:
        a height <Code>className</Code> on <Code>PanelGroup</Code> is silently
        overridden and the layout collapses to a thin line.{" "}
        <DocLink to="/docs/panel-group">PanelGroup</DocLink> has the full sizing
        contract, including the dev warning a group emits when it measures zero
        along its axis.
      </P>

      <H2 id="the-handle">The handle needs no styling</H2>
      <P>
        The handle carries no visible styles of its own: it renders an invisible
        hit area with a separator line that stays transparent at rest and fades
        in only while hovered, focused, or dragged — the seam appears when you
        reach for it and settles away otherwise. Theme the line with one CSS
        variable, <Code>--resizable-panels-resize-handle-color</Code>; for a
        thicker, always-visible, or fully custom divider, see{" "}
        <DocLink to="/docs/panel-resize-handle">Resize handles</DocLink>.
      </P>

      <Related
        items={[
          {
            to: "/docs/mental-model",
            label: "Mental model",
            note: "how groups, panels, and handles relate; peer vs docked panels",
          },
          {
            to: "/docs/building-layouts",
            label: "Building layouts",
            note: "docked sidebars, peer columns, and nested grids",
          },
          {
            to: "/docs/panel-group",
            label: "PanelGroup",
            note: "every prop the container accepts",
          },
          {
            to: "/docs/panel",
            label: "Panels",
            note: "sizing, docking, and collapse on the Panel itself",
          },
          {
            to: "/docs/sizing",
            label: "Sizing",
            note: "give panels initial, minimum, and maximum SizeSpec values",
          },
        ]}
      />
    </div>
  );
}
