import CollapsedTint from "../examples/styling-and-slot-props/collapsed-tint";
import collapsedTintSource from "../examples/styling-and-slot-props/collapsed-tint.tsx?raw";
import SlotProps from "../examples/styling-and-slot-props/slot-props";
import slotPropsSource from "../examples/styling-and-slot-props/slot-props.tsx?raw";
import StyledHandle from "../examples/styling-and-slot-props/styled-handle";
import styledHandleSource from "../examples/styling-and-slot-props/styled-handle.tsx?raw";
import {
  Callout,
  Code,
  DocLink,
  Example,
  H2,
  Kbd,
  P,
  Related,
  Table,
} from "../primitives";

export function StylingAndSlotPropsDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        The library owns layout, not looks. It sizes and clips your panels and
        paints a hairline separator; everything else is yours. You style panels
        the way you style any element — a <Code>className</Code> or{" "}
        <Code>style</Code> on the component — and you read the library&rsquo;s
        live state through data attributes, so a collapsed rail or an active
        handle restyles itself in CSS with no state plumbing. This page covers
        the data-attribute contract, the one CSS variable the handle exposes,
        and <Code>slotProps</Code> for the two elements a panel wraps around
        your content.
      </P>

      <H2 id="data-attributes">Style off data attributes</H2>
      <P>
        Every panel and handle publishes its live state as DOM attributes.
        Because they live on the rendered element, CSS reads them directly —
        Tailwind&rsquo;s <Code>data-[state=collapsed]:</Code> on the element
        itself, or <Code>in-data-[state=collapsed]:</Code> on a descendant that
        reacts to an ancestor&rsquo;s state — and you never mirror collapse or
        drag state into React just to change a color.
      </P>
      <Table
        headers={["Attribute", "Element", "Values"]}
        rows={[
          [
            "data-state",
            "panel root",
            <>
              <Code>"collapsed"</Code> or <Code>"expanded"</Code>.
              Cause-agnostic: it reads <Code>"collapsed"</Code> whether the
              user, a controlled prop, or the width folded the panel.
            </>,
          ],
          [
            "data-auto-collapsed",
            "panel root",
            <>
              Present (empty string) only during a width-driven fold from{" "}
              <DocLink to="/docs/collapsing">
                <Code>collapsible="auto"</Code>
              </DocLink>
              ; absent otherwise. The cause-specific companion to{" "}
              <Code>data-state</Code>.
            </>,
          ],
          [
            "data-kind",
            "panel root",
            <>
              <Code>"docked"</Code> or <Code>"peer"</Code> — which mode the
              panel is in.
            </>,
          ],
          [
            "data-side",
            "docked panel root",
            <>
              <Code>"start"</Code> or <Code>"end"</Code>. Absent on peers, which
              have no <Code>side</Code>.
            </>,
          ],
          [
            "data-axis",
            "panel root",
            <>
              <Code>"horizontal"</Code> or <Code>"vertical"</Code> — the
              group&rsquo;s orientation, mirrored onto each panel.
            </>,
          ],
          [
            "data-active",
            "handle",
            <>
              Present while the handle is hovered, has visible focus, or owns
              the live resize drag. The affordance signal — light the seam off
              it.
            </>,
          ],
          [
            "data-limited",
            "handle",
            "Present while a live drag is pinned against a min/max bound and can push no further.",
          ],
          [
            "data-disabled",
            "handle",
            <>
              Present when the handle cannot resize — its own{" "}
              <Code>disabled</Code>, the group&rsquo;s <Code>disabled</Code>, or
              a disabled neighbor.
            </>,
          ],
          [
            "data-toggle-only",
            "handle",
            <>
              Present when the seam cannot drag — its adjacent panel is
              collapsed to a zero rail — but <Kbd>Enter</Kbd> still expands it.
            </>,
          ],
          [
            "data-adjacent-collapsed",
            "handle",
            "Present when a panel on either side of the handle is collapsed.",
          ],
        ]}
      />
      <P>
        The handle also carries <Code>data-orientation</Code> (the
        separator&rsquo;s own axis, perpendicular to the drag) and, on a split
        coincident seam, <Code>data-pointer-hit-area</Code>. The separator line
        is a nested element tagged{" "}
        <Code>data-resizable-panels-resize-handle-line</Code> with its own{" "}
        <Code>data-active</Code> — see below.
      </P>

      <H2 id="collapsed-state">Style the collapsed state</H2>
      <P>
        <Code>data-state</Code> is the workhorse. Style the panel root off its
        own state with <Code>data-[state=collapsed]:</Code>, and any descendant
        off the ancestor with <Code>in-data-[state=collapsed]:</Code>. The rail
        pattern — hide labels, keep icons — lives on the{" "}
        <DocLink to="/docs/collapsing">collapsing</DocLink> page; here the same
        attribute tints the whole panel and recolors a status dot.
      </P>
      <Example
        title="Tint on collapse"
        caption="One data-state attribute drives the panel tint, a dot color, and the label — no React collapse tracking."
        whatToTry={[
          "Toggle the panel",
          "Watch the tint and dot change",
          "Drag the rail back open",
        ]}
        source={collapsedTintSource}
      >
        <CollapsedTint />
      </Example>
      <P>
        Because <Code>data-state</Code> is cause-agnostic, this CSS keeps
        working when the fold is width-driven instead of a button press. When
        you need to treat a width fold <em>specially</em> — a different tint for
        an automatic fold than a manual one — reach for the additive{" "}
        <Code>data-auto-collapsed</Code>, which is present only then.
      </P>

      <H2 id="handle-line">Recolor and restyle the handle line</H2>
      <P>
        The handle paints a 1px separator line, hidden at rest and fading in to{" "}
        <Code>0.6</Code> opacity when the handle lights. Its color comes from a
        single CSS custom property —{" "}
        <Code>--resizable-panels-resize-handle-color</Code>, defaulting to{" "}
        <Code>rgb(120, 120, 120)</Code>.
      </P>
      <P>
        Set the variable on any ancestor and it cascades to every handle line
        inside — recolor a whole group&rsquo;s seams in one place. Set it on{" "}
        <em>a wrapper</em> rather than on <Code>PanelGroup</Code>, whose{" "}
        <Code>style</Code> prop owns the group&rsquo;s <Code>width</Code>/
        <Code>height</Code>. For the affordance itself, key a background or ring
        off the handle&rsquo;s <Code>data-active</Code>.
      </P>
      <Example
        title="Custom handle line"
        caption="The CSS variable recolors the centered line; data-active tints the gutter while the handle is live."
        whatToTry={[
          "Switch the line color",
          "Hover — line and gutter light",
          "Drag it too",
        ]}
        source={styledHandleSource}
      >
        <StyledHandle />
      </Example>
      <P>
        For deeper restyling — a thicker line, a different rest opacity — target
        the line element directly. It is tagged{" "}
        <Code>data-resizable-panels-resize-handle-line</Code> and mirrors the
        lit state onto its own <Code>data-active</Code>, so you can key a full
        custom treatment off the line without touching the handle element that
        owns the pointer hit area.
      </P>

      <H2 id="slot-props">slotProps: the viewport and content elements</H2>
      <P>
        A <Code>Panel</Code> renders three nested elements: the root (where a
        plain <Code>className</Code>/<Code>style</Code> land), a{" "}
        <em>viewport</em> that clips and animates, and a <em>content</em>{" "}
        element that directly wraps your children. <Code>slotProps</Code> —
        typed <Code>PanelSlots</Code>, an object with <Code>viewport</Code> and{" "}
        <Code>content</Code> keys — reaches the inner two. Each key is a{" "}
        <Code>PanelSlotProps</Code>, i.e. native div attributes (
        <Code>className</Code>, <Code>style</Code>, event handlers, and the
        rest), so you can round the clip box, pad the content, or attribute
        either without a wrapper element.
      </P>
      <Example
        title="Styling the slots"
        caption="Root, viewport, and content are three separate elements — slotProps reaches the inner two."
        whatToTry={["Drag the seam narrower", "Inspect the nested divs"]}
        source={slotPropsSource}
      >
        <SlotProps />
      </Example>
      <P>
        Most panels never need this — <Code>className</Code> on{" "}
        <Code>{"<Panel>"}</Code> covers the common case. Reach for{" "}
        <Code>slotProps</Code> when you must style the clip box (the viewport)
        or inset your children (the content) without adding your own wrapper.
        The full <Code>PanelSlots</Code> / <Code>PanelSlotProps</Code> types are
        on the <DocLink to="/docs/component-props">component props</DocLink>{" "}
        page.
      </P>

      <H2 id="reserved-keys">Style keys the library owns</H2>
      <P>
        The viewport and content elements are structural: the library spreads
        its own layout <Code>style</Code> onto them <em>after</em> yours, so a
        handful of keys silently override anything you pass through{" "}
        <Code>slotProps.*.style</Code>. Setting one emits a development warning
        — it names the offending keys and slot, states that the library owns
        them and overrides your value, and tells you to style a nested element
        or the panel root instead — rather than failing quietly.
      </P>
      <Table
        headers={["Slot", "Library-owned keys", "Notes"]}
        rows={[
          [
            "viewport (both kinds)",
            <>
              <Code>position</Code>, <Code>inset</Code>, <Code>overflow</Code>
            </>,
            "The absolutely-filling clip box.",
          ],
          [
            "content (peer)",
            <>
              <Code>position</Code>, <Code>inset</Code>, <Code>overflow</Code>
            </>,
            "A peer's content fills its viewport absolutely.",
          ],
          [
            "content (docked)",
            <>
              <Code>position</Code>, <Code>overflow</Code>,{" "}
              <Code>transition</Code>, <Code>width</Code>, <Code>height</Code>,
              plus the axis anchor — <Code>top</Code> in a horizontal group,{" "}
              <Code>left</Code> in a vertical one
            </>,
            <>
              Anchored, sized, and transitioned per axis. The opposite-edge
              anchor varies with <Code>side</Code> and text direction and is not
              warned about.
            </>,
          ],
        ]}
      />
      <Callout title="Root and className are always yours">
        The warning covers only <Code>slotProps.*.style</Code>. A{" "}
        <Code>className</Code> on any slot, and every prop on{" "}
        <Code>{"<Panel>"}</Code> itself, land untouched — the reserved keys are
        inline layout styles, not class rules.
      </Callout>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        The separator line rests at <Code>0</Code> opacity, so a recolored line
        only shows once the handle lights — hover, focus, or drag it to see the
        color. <Code>data-active</Code> on the handle element stays truthful to
        the actually hovered or focused element, while the nested line&rsquo;s{" "}
        <Code>data-active</Code> is run-aware and also lights when a coincident
        sibling seam is the hovered one. And a <Code>className</Code> on{" "}
        <Code>PanelGroup</Code> cannot set its size — the inline{" "}
        <Code>width</Code>/<Code>height</Code> <Code>100%</Code> win; put a CSS
        variable or a size on a wrapper, or use the group&rsquo;s{" "}
        <Code>style</Code> prop.
      </P>

      <Related
        items={[
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: "the rail pattern that styles off data-state",
          },
          {
            to: "/docs/panel",
            label: "Panel",
            note: "where slotProps and className are declared",
          },
          {
            to: "/docs/component-props",
            label: "Component props",
            note: "the PanelSlots and PanelSlotProps types",
          },
        ]}
      />
    </div>
  );
}
