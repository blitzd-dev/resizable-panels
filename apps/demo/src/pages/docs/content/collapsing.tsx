import AutoCollapse from "../examples/collapsing/auto-collapse";
import autoCollapseSource from "../examples/collapsing/auto-collapse.tsx?raw";
import CollapsibleSidebar from "../examples/collapsing/collapsible-sidebar";
import collapsibleSidebarSource from "../examples/collapsing/collapsible-sidebar.tsx?raw";
import DragToCollapse from "../examples/collapsing/drag-to-collapse";
import dragToCollapseSource from "../examples/collapsing/drag-to-collapse.tsx?raw";
import RailCollapse from "../examples/collapsing/rail-collapse";
import railCollapseSource from "../examples/collapsing/rail-collapse.tsx?raw";
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

// The app-side recipe for teams that want the fold policy hand-rolled, or
// need a demotion the in-flow primitive does not own (panel → sheet/drawer).
const autoCookbookSource = `import { usePanelGroupState, usePanelActions } from "@blitzd/resizable-panels";

function AutoFoldTrailing({ groupId, panelId, threshold }: {
  groupId: string;
  panelId: string;
  threshold: number; // Σ minSize + gutters below which the trailing panel folds
}) {
  const { containerSize, measured } = usePanelGroupState(groupId);
  const actions = usePanelActions();

  useEffect(() => {
    if (!measured) return;
    actions.setCollapsed({ groupId, panelId }, containerSize < threshold);
  }, [measured, containerSize, threshold, groupId, panelId, actions]);

  return null;
}`;

export function CollapsingDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        A collapsible panel shrinks to a minimum — all the way to nothing, or
        down to a compact rail — and expands back. Use it for sidebars that tuck
        away, icon rails that stay reachable, and panels that snap shut when
        dragged small enough. This page covers all four ways a panel collapses:
        a button, a drag past a threshold, the <Kbd>Enter</Kbd> key, and the
        container itself running out of room.
      </P>

      <H2 id="collapse-off-canvas">Collapse off-canvas</H2>
      <P>
        Docked panels (a <Code>Panel</Code> with a <Code>side</Code>) are
        collapsible by default. Wire a button to <Code>apiRef</Code>&rsquo;s{" "}
        <Code>toggle()</Code> and you have a working sidebar; <Kbd>Enter</Kbd>{" "}
        on the adjacent handle does the same thing for keyboard users.
      </P>
      <Example
        title="Sidebar that collapses to nothing"
        caption="toggle() drives the collapse; the panel animates fully off-canvas."
        whatToTry={["Toggle the sidebar", "Press Enter on the seam"]}
        source={collapsibleSidebarSource}
      >
        <CollapsibleSidebar />
      </Example>
      <P>
        With the default <Code>collapsedSize</Code> of <Code>0</Code> the
        collapsed panel has no width. The library marks it{" "}
        <Code>aria-hidden</Code> and <Code>inert</Code>: it leaves the
        accessibility tree and the tab order, so no one can land inside a panel
        they cannot see.
      </P>

      <H2 id="rail">Keep a compact rail</H2>
      <P>
        A non-zero <Code>collapsedSize</Code> collapses to a compact rail
        instead of hiding the panel. The rail keeps its size, stays in the
        accessibility tree, and its buttons stay clickable — the icon-rail
        pattern. Add <Code>resizableWhenCollapsed</Code> to keep the handle live
        while collapsed, so the rail can be dragged back open. (Without it, the
        handle ignores a collapsed panel; with a zero <Code>collapsedSize</Code>{" "}
        it has no effect — there is nothing on screen to grab.)
      </P>
      <P>
        Style the rail state with CSS, not React state: the panel root carries{" "}
        <Code>data-state="collapsed"</Code>, so descendants can hide labels and
        center icons the moment the collapse starts —{" "}
        <Code>in-data-[state=collapsed]:hidden</Code> in Tailwind, no collapse
        tracking in your components.
      </P>
      <Example
        title="Collapsible icon rail"
        caption="collapsedSize={56} leaves an accessible rail; labels hide via data-state, and resizableWhenCollapsed lets a drag reopen it."
        whatToTry={[
          "Toggle the rail — labels hide, icons stay",
          "Drag the collapsed rail open",
          "Tab in while collapsed",
        ]}
        source={railCollapseSource}
      >
        <RailCollapse />
      </Example>

      <H2 id="drag-to-collapse">Collapse by dragging past a threshold</H2>
      <P>
        <Code>collapseBelow</Code> turns a drag into a close gesture. While the
        pointer pushes inward the panel holds at <Code>minSize</Code>; past the
        threshold it snaps shut. Reopening requires dragging back out to at
        least <Code>minSize</Code>, and <Code>collapseBelowHysteresis</Code>{" "}
        (default <Code>12</Code>px) adds a neutral band so a jittery pointer
        cannot flicker the panel open and closed at the boundary.{" "}
        <Code>collapseBelowBehavior</Code> picks the motion:{" "}
        <Code>"animated"</Code> (default) glides shut, <Code>"instant"</Code>{" "}
        closes in one frame.
      </P>
      <Example
        title="Drag past the threshold"
        caption="Both rows collapse below 90px — the top row animates, the bottom snaps."
        whatToTry={[
          "Drag each seam past the snap point",
          "Reverse right after — it stays shut",
        ]}
        source={dragToCollapseSource}
        frameClassName="h-72"
      >
        <DragToCollapse />
      </Example>
      <Callout title="Pointer drags only">
        <Code>collapseBelow</Code> shapes pointer drags only.{" "}
        <Code>toggle()</Code>, <Code>collapse()</Code>, and <Kbd>Enter</Kbd>{" "}
        collapse the panel directly, at any width.
      </Callout>

      <H2 id="auto">Fold automatically when space runs out</H2>
      <P>
        <Code>collapsible="auto"</Code> folds the panel to its rail when its
        declared <Code>minSize</Code> stops fitting the container, and releases
        it when space returns. The trigger is the container width — not a drag,
        not a media query. No <Code>matchMedia</Code>, no breakpoint math.
      </P>
      <Example
        title="Responsive auto-collapse"
        caption="The sidebar folds to a 56px rail the moment its 180px minimum stops fitting."
        whatToTry={[
          "Drag the edge handle until the sidebar folds",
          "Reopen the rail while narrow — it sticks",
          "Widen to reset",
        ]}
        source={autoCollapseSource}
      >
        <AutoCollapse />
      </Example>
      <Callout title="The rules in one breath">
        Folds when <Code>minSize</Code> no longer fits; releases in reverse
        order when space returns. With several <Code>auto</Code> panels the
        last-declared folds first — declare your primary surface first. A manual
        expand sticks until the panel fits again. An auto-fold is never written
        to persistence.
      </Callout>
      <P>
        The fold set is a pure function of the declared minimums and the
        container width, so it cannot flap: shrinking keeps folded panels
        folded, and growing releases them in reverse. A user who manually
        expands an auto-folded panel wins — the panel stays open at any narrower
        width, and width-driven folding only resumes once space returns and the
        panel fits again. An explicit open stays open, the way sidebars behave
        in shipping apps.
      </P>
      <P>
        Presentation follows the effective state. <Code>data-state</Code> is
        cause-agnostic — it reads <Code>"collapsed"</Code> whether the user
        collapsed the panel or the width did, so existing CSS keeps working —
        and the additive <Code>data-auto-collapsed</Code> attribute marks
        width-driven folds specifically. What each readout reports during a
        width-driven fold:
      </P>
      <Table
        headers={["Readout", "Reports", "Why"]}
        rows={[
          [
            "data-state / isCollapsed()",
            <Code>"collapsed"</Code>,
            <>
              Panel readouts describe what is on screen.{" "}
              <Code>usePanelControls().collapsed</Code> and ARIA agree.
            </>,
          ],
          [
            "onCollapsedChange",
            <>
              fires with <Code>{'trigger: "system"'}</Code>
            </>,
            <>
              A width-driven fold is a real transition — you can observe it, and
              tell it apart from a user action by its trigger.
            </>,
          ],
          [
            "getValue() / onValueChange",
            <>
              keeps the stored bit (<Code>false</Code>)
            </>,
            <>
              The group value is the user&rsquo;s saved preference. Auto-folds
              never persist, so <Code>setValue(getValue())</Code> round-trips
              safely and a reload at a wide size restores the panel open.
            </>,
          ],
        ]}
      />
      <P>
        Two requirements: <Code>auto</Code> needs a non-zero{" "}
        <Code>collapsedSize</Code> (it folds to a visible rail, never a silent
        vanish — a zero rail warns and behaves as plain <Code>collapsible</Code>
        ), and it is inert on a controlled (<Code>collapsed</Code>) panel, where
        your prop is the authority.
      </P>
      <P>
        Prefer to own the policy — or demote the panel to an overlay sheet
        instead of a rail? Read the container width from{" "}
        <DocLink to="/docs/reading-state">
          <Code>usePanelGroupState</Code>
        </DocLink>{" "}
        and drive <Code>setCollapsed</Code> yourself. Out-of-flow demotion
        (panel &rarr; sheet) is deliberately left to your app:
      </P>
      <Pre>{autoCookbookSource}</Pre>

      <H2 id="props">Collapse props</H2>
      <P>
        Declared on <Code>Panel</Code> (full list on the{" "}
        <DocLink to="/docs/panel">Panels</DocLink> page). Every size accepts a{" "}
        <DocLink to="/docs/sizing">
          <Code>SizeSpec</Code>
        </DocLink>
        .
      </P>
      <Table
        rows={[
          [
            "collapsible",
            'boolean | "auto"',
            <>
              Whether the panel can collapse. Defaults to <Code>true</Code> for
              docked panels, <Code>false</Code> for peers — turn a peer
              collapsible before any prop below takes effect.{" "}
              <Code>"auto"</Code> adds{" "}
              <DocLink to="#auto">width-driven folding</DocLink>.
            </>,
          ],
          [
            "defaultCollapsed",
            "boolean",
            <>
              Start collapsed. Ignored when <Code>collapsible</Code> is{" "}
              <Code>false</Code>.
            </>,
          ],
          [
            "collapsedSize",
            "SizeSpec",
            <>
              Rendered size while collapsed. Default <Code>0</Code> hides the
              panel (<Code>aria-hidden</Code>/<Code>inert</Code>); non-zero
              leaves an accessible rail. Clamped to <Code>minSize</Code>.
            </>,
          ],
          [
            "resizableWhenCollapsed",
            "boolean",
            <>
              Keep the adjacent handle live while collapsed so a non-zero rail
              can be dragged open. No effect at <Code>collapsedSize</Code>{" "}
              <Code>0</Code>.
            </>,
          ],
          [
            "collapseBelow",
            "SizeSpec",
            <>
              Pointer-drag threshold: collapse when a drag pushes the panel
              below this width. Drag-to-close in addition to buttons and keys.
            </>,
          ],
          [
            "collapseBelowHysteresis",
            "SizeSpec",
            <>
              Neutral band around <Code>collapseBelow</Code> against pointer
              jitter. Default <Code>12</Code>px — raise it if collapse feels
              twitchy.
            </>,
          ],
          [
            "collapseBelowBehavior",
            "PanelCollapseBelowBehavior",
            <>
              <Code>"animated"</Code> (default) glides shut;{" "}
              <Code>"instant"</Code> snaps in one frame. Only meaningful with{" "}
              <Code>collapseBelow</Code>.
            </>,
          ],
        ]}
      />

      <H2 id="gotchas">Gotchas</H2>
      <P>
        Collapse props on a non-collapsible panel warn and do nothing — this
        bites most on peers, which are non-collapsible by default.{" "}
        <Code>collapseBelowBehavior</Code> without <Code>collapseBelow</Code>{" "}
        also warns. And reduced-motion users get collapse animations suppressed
        automatically; never branch on that yourself.
      </P>

      <Related
        items={[
          {
            to: "/docs/panel",
            label: "Panel",
            note: "where these props live, alongside sizing and docking",
          },
          {
            to: "/docs/imperative-and-actions",
            label: "Driving panels from code",
            note: "toggle/collapse/expand from a button",
          },
          {
            to: "/docs/controlled-state",
            label: "Controlled state & events",
            note: "observe or own the collapsed state",
          },
          {
            to: "/docs/accessibility",
            label: "Keyboard & accessibility",
            note: "the Enter toggle and hidden-panel focus behavior",
          },
        ]}
      />
    </div>
  );
}
