import Hero from "../examples/introduction/hero";
import heroSource from "../examples/introduction/hero.tsx?raw";
import { Code, DocLink, Example, H2, P, Related, Table } from "../primitives";

export function IntroductionDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        <Code>@blitzd/resizable-panels</Code> is a set of headless React
        primitives for application layouts whose regions users can resize,
        collapse, and restore. It handles geometry, interaction, and
        accessibility; your application supplies the content, visual design, and
        layout policy.
      </P>

      <Example
        title="A resizable workspace"
        caption="Three regions — a docked nav, an editor, and a docked inspector — sharing one axis."
        whatToTry={[
          "Drag either seam",
          "Press Enter on the right seam",
          "Press Enter again to restore",
        ]}
        source={heroSource}
      >
        <Hero />
      </Example>

      <P>
        That layout is three <Code>Panel</Code>s and two{" "}
        <Code>PanelResizeHandle</Code>s inside one <Code>PanelGroup</Code> — no
        stylesheet imported, no theme prescribed. The primitives apply the
        structural geometry that resizing needs; every color, border, and label
        above is ordinary application markup.
      </P>

      <H2 id="what-it-owns">What the library owns, what your app owns</H2>
      <P>
        The split is deliberate: the library takes the parts that are hard to
        get right and leaves everything visual and editorial to you.
      </P>
      <Table
        headers={["Concern", "The library owns", "Your app owns"]}
        rows={[
          [
            "Sizing & geometry",
            "Size resolution, boundary movement, and RTL",
            "The outer container's dimensions and each panel's constraints",
          ],
          [
            "Interaction",
            "Pointer and keyboard resizing, accessible separators",
            "When outside controls collapse or reset",
          ],
          [
            "State",
            "Collapse, persistence, and reduced-motion plumbing",
            "The collapse policy and responsive layout changes",
          ],
          [
            "Presentation",
            "Structural geometry and data-state style hooks",
            "Content, color, borders, and labels",
          ],
        ]}
      />
      <P>
        It is intentionally not a free-form grid or a drag-and-drop canvas. It
        moves the boundaries between stable regions rather than rearranging
        arbitrary items — navigation beside content, an editor beside an
        inspector, or nested workspace panes.
      </P>

      <H2 id="how-the-docs-work">How these docs are organized</H2>
      <P>
        The documentation runs in three layers, matching the sidebar. Get
        started is the shortest path to a working split —{" "}
        <DocLink to="/docs/installation">Installation</DocLink> puts one on
        screen, and <DocLink to="/docs/mental-model">Mental model</DocLink>{" "}
        gives you the vocabulary and sizing model the rest of the docs assume.
        The guides are task-oriented pages that build the system up in layers:{" "}
        <DocLink to="/docs/building-layouts">building layouts</DocLink>,{" "}
        <DocLink to="/docs/sizing">sizing</DocLink>,{" "}
        <DocLink to="/docs/collapsing">collapsing</DocLink>,{" "}
        <DocLink to="/docs/persistence">persistence</DocLink>, and{" "}
        <DocLink to="/docs/accessibility">keyboard &amp; accessibility</DocLink>
        . The reference holds exhaustive prop and type tables for every export —
        start with{" "}
        <DocLink to="/docs/panel-group">
          <Code>PanelGroup</Code>
        </DocLink>
        ,{" "}
        <DocLink to="/docs/panel">
          <Code>Panel</Code>
        </DocLink>
        , and{" "}
        <DocLink to="/docs/panel-resize-handle">
          <Code>PanelResizeHandle</Code>
        </DocLink>
        , and reach for them once you know which concept you need.
      </P>
      <P>
        Every guide teaches its concept once and links elsewhere for the rest,
        so you can read start-to-finish or jump straight to a page.
      </P>

      <H2 id="compatibility">Compatibility</H2>
      <P>
        The package supports React 18.2 and React 19 — React is its only peer
        dependency. It ships as ESM and targets modern Chrome, Firefox, Safari,
        and Edge.
      </P>

      <Related
        items={[
          {
            to: "/docs/installation",
            label: "Installation",
            note: "add the package and render your first split",
          },
          {
            to: "/docs/mental-model",
            label: "Mental model",
            note: "group, panel, handle, and the sizing model",
          },
        ]}
      />
    </div>
  );
}
