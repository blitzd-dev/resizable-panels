import CalcAndPitfalls from "../examples/sizing/calc-and-pitfalls";
import calcSource from "../examples/sizing/calc-and-pitfalls.tsx?raw";
import CascadeLatching from "../examples/sizing/cascade-latching";
import cascadeSource from "../examples/sizing/cascade-latching.tsx?raw";
import ContainerResize from "../examples/sizing/container-resize";
import containerSource from "../examples/sizing/container-resize.tsx?raw";
import SizeUnits from "../examples/sizing/size-units";
import sizeUnitsSource from "../examples/sizing/size-units.tsx?raw";
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

export function SizingDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        Every size you give a panel — <Code>defaultSize</Code>,{" "}
        <Code>minSize</Code>, <Code>maxSize</Code>, <Code>collapsedSize</Code>,
        and the collapse thresholds — is a <Code>SizeSpec</Code>. It is a small,
        strict grammar, and its rules are the most common source of console
        warnings when you start out. This page is the reference for writing
        valid sizes and for the three group behaviors that decide how those
        sizes move: over-constrained clipping, cascade reversal, and container
        rescaling.
      </P>
      <P>
        One box is <em>not</em> a <Code>SizeSpec</Code>: the group itself. A{" "}
        <Code>PanelGroup</Code> fills its container, so the container must carry
        a definite size along the axis —{" "}
        <DocLink to="/docs/building-layouts">Building layouts</DocLink> covers
        that wrapper. In the first example each row sits in an explicit
        fixed-height wrapper <Code>div</Code>, and the panel sizes resolve
        inside it.
      </P>

      <H2 id="units">A number is pixels, a string carries its unit</H2>
      <P>
        A bare number is always pixels: <Code>defaultSize={"{240}"}</Code> means
        240px. A string must carry a unit — <Code>"240px"</Code>,{" "}
        <Code>"33%"</Code>, <Code>"2rem"</Code>. The panel below is written
        three ways; all three are valid, and everything the grammar accepts is
        also valid CSS with the identical meaning.
      </P>
      <Example
        title="Number, percent, rem"
        caption="A number is pixels; a string carries its unit — px, %, and rem all size the same panel."
        whatToTry={["Drag a seam", "Resize the window — % re-measures"]}
        source={sizeUnitsSource}
      >
        <SizeUnits />
      </Example>
      <P>
        A percentage resolves against the group&rsquo;s size along its axis, and
        it keeps resolving: a <Code>"50%"</Code> panel tracks the container as
        the container grows or shrinks, the same way CSS does. Resolution is
        dynamic — the spec is evaluated against live group, viewport, and font
        metrics on every layout pass, not frozen at mount.
      </P>

      <H2 id="grammar">The grammar</H2>
      <P>A string spec is exactly one of these three shapes:</P>
      <Pre lang="ts">{`// 1. one dimension with a required unit
"240px"  "33%"  "2rem"  "1.5em"  "10vw"  "50vh"

// 2. the literal "0" — the only unitless string allowed
"0"

// 3. a calc() combining dimensions with + and -
"calc(100% - 240px)"   "calc(50% - 24px)"`}</Pre>
      <P>
        Units are <Code>px</Code>, <Code>%</Code>, <Code>em</Code>,{" "}
        <Code>rem</Code>, <Code>vw</Code>, and <Code>vh</Code>. Where each
        resolves:
      </P>
      <Table
        headers={["Unit", "Resolves against", "Notes"]}
        rows={[
          [
            "px",
            "pixels",
            <>
              An absolute length. A number and its px string are equivalent:{" "}
              <Code>240 === "240px"</Code>.
            </>,
          ],
          [
            "%",
            "group axis size",
            "Fraction of the group's own width (horizontal) or height (vertical). Re-resolves as the container changes.",
          ],
          [
            "em / rem",
            "font size",
            "em against the panel's computed font-size; rem against the document root's. Use for sizing that should scale with type.",
          ],
          [
            "vw / vh",
            "viewport",
            "Fraction of the viewport width / height. Independent of the group's own box.",
          ],
        ]}
      />
      <P>
        Every unit resolves in CSS layout pixels, and an ancestor{" "}
        <Code>transform: scale()</Code> doesn&rsquo;t change that. Inside a
        scaled ancestor — a zoomed-out preview, a design-tool canvas —
        configured sizes, min/max clamps, and keyboard steps keep their
        layout-pixel meaning, and pointer drags compensate for the scale so the
        seam tracks the cursor 1:1.
      </P>

      <H2 id="calc-rules">calc() and the rules that trip people up</H2>
      <P>
        Arithmetic is allowed, but only inside <Code>calc()</Code> and only with
        a narrow set of operators. The reason is deliberate: the layout
        allocator needs to resolve every size to pixels synchronously — during
        server render, inside imperative actions, across browsers — so anything
        the engine cannot evaluate itself is rejected.
      </P>
      <Table
        headers={["Verdict", "Spec", "Why"]}
        rows={[
          [
            "Valid",
            <Code>"calc(100% - 240px)"</Code>,
            "Whitespace on both sides of + and -.",
          ],
          [
            "Rejected",
            <Code>"50% - 24px"</Code>,
            <>
              Arithmetic must be wrapped in <Code>calc()</Code>.
            </>,
          ],
          [
            "Rejected",
            <Code>"calc(50% -24px)"</Code>,
            'No space after the -. In CSS "-24px" reads as a negative dimension, so whitespace is required on both sides.',
          ],
          [
            "Rejected",
            <Code>"calc(50% * 2)"</Code>,
            "Only + and - are supported; * and / are not.",
          ],
          [
            "Rejected",
            <Code>"clamp(...)" / "var(...)"</Code>,
            "No CSS functions other than calc() — they cannot be resolved to a deterministic pixel value.",
          ],
          [
            "Rejected",
            <Code>"240"</Code>,
            <>
              A bare numeric string has no unit. Pass the number{" "}
              <Code>240</Code>, or <Code>"240px"</Code>.
            </>,
          ],
        ]}
      />
      <P>
        The example below calls <Code>setSize()</Code> with each spec through a
        panel&rsquo;s <Code>apiRef</Code>. Every action returns an authoritative
        result: a valid spec reports the accepted pixel value, while an invalid
        one is rejected with <Code>reason: "invalid-size"</Code> and no size is
        touched. Click through the red buttons to see the rejections.
      </P>
      <Example
        title="setSize accepts and rejects specs"
        caption="setSize reports accepted pixels for a valid spec and rejects an invalid one as invalid-size."
        whatToTry={[
          "Click a valid spec",
          "Click a red spec",
          "Drag the seam, re-apply",
        ]}
        source={calcSource}
      >
        <CalcAndPitfalls />
      </Example>
      <P>
        <Code>setSize()</Code> is the one path that surfaces the error to you in
        its return value — see{" "}
        <DocLink to="/docs/imperative-and-actions">
          Driving panels from code
        </DocLink>
        . On a prop, an invalid spec does not throw and does not break the
        layout — it falls back per field, covered under Gotchas below.
      </P>

      <H2 id="bounds">Bounding a size with minSize and maxSize</H2>
      <P>
        <Code>minSize</Code> and <Code>maxSize</Code> are <Code>SizeSpec</Code>{" "}
        values too, so the same grammar applies. They clamp the panel: a drag, a{" "}
        <Code>setSize()</Code> call, or a container-driven rescale can never
        push the panel outside <Code>[minSize, maxSize]</Code>. Peers default to
        a <Code>minSize</Code> of <Code>0</Code>, docked panels to{" "}
        <Code>200</Code>, and both to a <Code>maxSize</Code> of{" "}
        <Code>"100%"</Code> (never larger than the group). When a request hits a
        bound, the result reports <Code>constrained: true</Code> alongside the
        value that actually landed. Full prop details live on the{" "}
        <DocLink to="/docs/panel">Panel</DocLink> page.
      </P>

      <H2 id="overconstrained">When the minimums do not fit</H2>
      <P>
        A declared minimum is a floor, not a suggestion. When the container is
        too small to hold every panel&rsquo;s <Code>minSize</Code>, the group
        never squishes past those minimums — each panel keeps its{" "}
        <Code>minSize</Code> and whatever no longer fits overflows past the
        group&rsquo;s end edge and is clipped. The start edge always stays put,
        and the layout is fully reversible: the declared sizes return the
        instant space returns.
      </P>
      <P>
        While this is happening the group sets <Code>data-overconstrained</Code>{" "}
        on its element (and warns once in development), so you can respond in
        pure CSS. The one-line opt-in turns the clipped overflow into a
        scrollbar:
      </P>
      <Pre>{`<PanelGroup style={{ overflow: "auto" }}>`}</Pre>
      <Callout variant="warning" title="Never-squish is the invariant">
        The group applies <Code>overflow: "hidden"</Code> before your{" "}
        <Code>style</Code>, so passing <Code>overflow: "auto"</Code> wins — no
        prop required. The development warning spells out the alternatives:
        &ldquo;Reduce a minSize, collapse a panel, or let the group scroll with{" "}
        <Code>style=&#123;&#123; overflow: "auto" &#125;&#125;</Code>.&rdquo;
        Reach for <Code>data-overconstrained</Code> when the right answer is
        structural instead — a sheet, a drawer, or collapsing a panel — and
        style or script off the attribute to switch layouts.
      </Callout>

      <H2 id="cascade">Cascade: reversible vs latching</H2>
      <P>
        When a drag pushes a neighbor down to its <Code>minSize</Code>, the push
        does not stop there — it <em>cascades</em> through to the next panel,
        and the next. The group-level <Code>cascade</Code> prop — a{" "}
        <Code>PanelGroupCascade</Code> — decides what happens when you reverse
        such a drag <em>without releasing</em>. Drag the A&nbsp;|&nbsp;B handle
        right until B bottoms out at 60px and C starts shrinking, then, still
        holding, drag back left and watch which panel regrows first under each
        mode.
      </P>
      <Example
        title="Reversible vs latching cascade"
        caption="reversible retraces the cascade on reverse; latching regrows the boundary-adjacent panel first."
        whatToTry={[
          "Drag A|B right until C shrinks",
          "Reverse without releasing",
          "Switch mode and repeat",
        ]}
        source={cascadeSource}
      >
        <CascadeLatching />
      </Example>
      <P>
        <Code>"reversible"</Code> (the default) treats a held drag as one
        transaction computed from where the drag began, so reversing exactly
        retraces the cascade: the far panel (C) returns to its original size
        before the boundary-adjacent panel (B) regrows. Overshoot is always
        recoverable. <Code>"latching"</Code> makes cascade pushes one-way within
        a held drag: reversing regrows the boundary-adjacent panel (B) first,
        and the far panel (C) keeps its pushed size until returned space reaches
        it. An invalid value falls back to <Code>"reversible"</Code> with a dev
        warning.
      </P>
      <P>
        Only pointer drags differ between the modes. Keyboard steps and
        imperative actions are atomic single changes, and across sessions the
        two are identical: sizes commit on release, and a new drag starts from
        the committed state — so reversing within a <em>fresh</em> drag regrows
        the boundary-adjacent panel first in both modes. Latching also keeps a
        small jitter dead-band, so a cascade push of a couple of pixels or less
        gives that space back on reversal rather than latching — the guard
        working, not a bug.
      </P>

      <H2 id="container-resize">Responding to a container resize</H2>
      <P>
        A panel starts at its <Code>defaultSize</Code>, but what happens to its
        pixel width when the group&rsquo;s <em>own</em> size changes — the
        window resizes, a sibling toolbar appears? That is{" "}
        <Code>containerResizeBehavior</Code>, a{" "}
        <Code>PanelContainerResizeBehavior</Code>:
      </P>
      <Table
        headers={["Value", "Type", "Behavior"]}
        rows={[
          [
            '"fixed"',
            "PanelContainerResizeBehavior",
            "Keep the current pixel size; the remaining panels absorb the change. Default for docked panels — a 200px sidebar stays 200px.",
          ],
          [
            '"proportional"',
            "PanelContainerResizeBehavior",
            "Rescale to keep the same share of the group. Default for peers — a half-width pane stays half-width as the window resizes.",
          ],
        ]}
      />
      <P>
        Both groups below start with a 200px docked panel. Shrink the shared
        container and watch the difference: the <Code>"fixed"</Code> panel holds
        200px while its neighbor gives up space; the <Code>"proportional"</Code>{" "}
        panel shrinks to keep its fraction.
      </P>
      <Example
        title="Fixed vs proportional container resize"
        caption="fixed holds a panel's pixels as the container shrinks; proportional keeps its share."
        whatToTry={[
          "Shrink the container",
          "Watch fixed hold 200px",
          "Watch proportional rescale",
        ]}
        source={containerSource}
        frameClassName="h-72"
      >
        <ContainerResize />
      </Example>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        <strong>Relative units start at 0.</strong> Percentages and viewport
        units need a measured container to resolve, which isn&rsquo;t available
        until after the first paint. A string default keeps tracking the
        container like CSS — re-resolving as it resizes — until a drag, an
        imperative action, or a persistence restore commits a pixel preference;
        only then does it hold pixels. Do not read <Code>getSize()</Code>{" "}
        synchronously on mount and expect the resolved pixel value.
      </P>
      <P>
        <strong>Invalid props fall back per field, they do not throw.</strong>{" "}
        An invalid spec on a prop emits a development warning once (per
        panel/property/value) and each field substitutes a safe default:{" "}
        <Code>collapsedSize</Code> → <Code>0</Code>, <Code>collapseBelow</Code>{" "}
        → absent, and a docked <Code>defaultSize</Code> degrades to its{" "}
        <Code>minSize</Code> at error severity. Production builds stay silent;
        the fallback keeps the layout math safe either way. The grammar above is
        the warning you are most likely to hit first, so it is worth getting
        right.
      </P>

      <Related
        items={[
          {
            to: "/docs/panel",
            label: "Panel",
            note: "every prop that takes a SizeSpec",
          },
          {
            to: "/docs/building-layouts",
            label: "Building layouts",
            note: "the sized container the group fills",
          },
          {
            to: "/docs/collapsing",
            label: "Collapsing panels",
            note: "collapsedSize and collapseBelow thresholds",
          },
          {
            to: "/docs/layout-types",
            label: "Layout & sizing types",
            note: "the SizeSpec signature and neighboring types",
          },
        ]}
      />
    </div>
  );
}
