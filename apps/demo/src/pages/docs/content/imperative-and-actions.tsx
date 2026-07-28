import DispatchToolbar from "../examples/imperative-and-actions/dispatch-toolbar";
import dispatchToolbarSource from "../examples/imperative-and-actions/dispatch-toolbar.tsx?raw";
import GroupApiRef from "../examples/imperative-and-actions/group-apiref";
import groupApiRefSource from "../examples/imperative-and-actions/group-apiref.tsx?raw";
import GroupCommands from "../examples/imperative-and-actions/group-commands";
import groupCommandsSource from "../examples/imperative-and-actions/group-commands.tsx?raw";
import Maximize from "../examples/imperative-and-actions/maximize";
import maximizeSource from "../examples/imperative-and-actions/maximize.tsx?raw";
import PanelApiRef from "../examples/imperative-and-actions/panel-apiref";
import panelApiRefSource from "../examples/imperative-and-actions/panel-apiref.tsx?raw";
import ReadingResults from "../examples/imperative-and-actions/reading-results";
import readingResultsSource from "../examples/imperative-and-actions/reading-results.tsx?raw";
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

export function ImperativeAndActionsDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        Drive panels from your own code — a toolbar button that collapses the
        sidebar, a menu item that resets the layout, a shortcut that maximizes
        the editor. There are two channels for the same action vocabulary. An{" "}
        <Code>apiRef</Code> wires directly to one panel or group you already
        render; <Code>usePanelActions</Code> hands you a dispatcher that reaches
        any panel by its address, from a control that lives anywhere under the
        provider. Both speak the same <Code>PanelActions</Code> — collapse,
        expand, toggle, resize, maximize, reset — and both return an
        authoritative result you can read.
      </P>

      <H2 id="panel-apiref">Drive one panel with apiRef</H2>
      <P>
        Pass a ref to a <Code>Panel</Code>&rsquo;s <Code>apiRef</Code> prop.
        Once the panel mounts, <Code>ref.current</Code> is a{" "}
        <Code>PanelApi</Code>: the bound <Code>PanelActions</Code> (
        <Code>setSize</Code>, <Code>maximize</Code>, <Code>setCollapsed</Code>,{" "}
        <Code>collapse</Code>, <Code>expand</Code>, <Code>toggle</Code>,{" "}
        <Code>reset</Code>) plus three non-reactive getters.
      </P>
      <P>
        The getters are methods, not values, because an imperative channel
        cannot subscribe to changes: <Code>getSize()</Code> returns the
        preferred size in pixels, <Code>getRenderedSize()</Code> the size
        actually on screen — they differ when a panel is collapsed or
        over-constrained — and <Code>isCollapsed()</Code> the collapsed flag.
        Each is a snapshot: call it when you need the value, never cache it.
      </P>
      <Example
        title="Panel apiRef"
        caption="A PanelApi exposes bound actions plus snapshot getters for one panel."
        whatToTry={[
          "Toggle, collapse, and expand the sidebar",
          "Read the snapshot at different widths",
        ]}
        source={panelApiRefSource}
      >
        <PanelApiRef />
      </Example>

      <H2 id="panel-actions">The panel action set</H2>
      <P>
        Every action takes an optional <Code>PanelActionOptions</Code> and
        returns a result you can read (see{" "}
        <DocLink to="#results">reading results</DocLink>). This is the same{" "}
        <Code>PanelActions</Code> surface the dispatcher and the read
        hooks&rsquo; <Code>PanelControls</Code> carry, so the vocabulary
        transfers verbatim between channels — the last row is the exception: it
        lists <Code>PanelApi</Code>-only getters that take no options and do not
        appear on the dispatcher or <Code>PanelControls</Code>.
      </P>
      <Table
        headers={["Action", "Returns", "Notes"]}
        rows={[
          [
            "setSize(size, options?)",
            <Code>SizeSpec → number result</Code>,
            <>
              Set the preferred size. Clamped to <Code>[minSize, maxSize]</Code>{" "}
              and to available group space; the result&rsquo;s{" "}
              <Code>value</Code> is what actually landed.
            </>,
          ],
          [
            "maximize(options?)",
            <Code>number result</Code>,
            <>
              Expand and grow the preferred size to the resolved maximum. The
              applied and <Code>unchanged</Code> arms both carry a numeric size.
            </>,
          ],
          [
            "collapse() / expand()",
            <Code>true / false result</Code>,
            <>
              Force the collapsed state one direction. Reject with{" "}
              <Code>not-collapsible</Code> on a non-collapsible panel.
            </>,
          ],
          [
            "toggle(options?)",
            <Code>boolean result</Code>,
            "Flip the collapsed state — the one action behind a single open/close button.",
          ],
          [
            "setCollapsed(collapsed, options?)",
            <Code>boolean result</Code>,
            "Set the collapsed state to an explicit boolean when you already know the target.",
          ],
          [
            "reset(options?)",
            <Code>PanelValue result</Code>,
            <>
              Re-resolve declarative defaults (<Code>defaultSize</Code>{" "}
              re-evaluated, <Code>defaultCollapsed</Code>) and re-run peer
              allocation. Never the pixels from first load, never a restored
              value.
            </>,
          ],
          [
            "getSize() / getRenderedSize() / isCollapsed()",
            <Code>number / number / boolean</Code>,
            "Non-reactive reads on PanelApi. Preferred px, rendered px, collapsed flag. Snapshots — call on demand.",
          ],
        ]}
      />
      <P>
        <Code>PanelActionOptions</Code> is{" "}
        <Code>{`{ transition?: "default" | "none" }`}</Code>. Pass{" "}
        <Code>{`{ transition: "none" }`}</Code> to apply the change instantly,
        without the size animation — useful when several actions fire together,
        or when you are restoring a layout and do not want it to animate into
        place.
      </P>

      <H2 id="maximize">Maximize and restore</H2>
      <P>
        <Code>maximize()</Code> expands a collapsed panel and grows its
        preferred size to the resolved maximum in one call — the &ldquo;focus
        this pane&rdquo; gesture. It reports the numeric size it reached, and
        adds <Code>PanelSizeActionDetails</Code> so you can tell a bounded
        maximize (<Code>constrained: true</Code>) from one that hit the ceiling
        you asked for. Pair it with <Code>reset()</Code> to fall back to the
        declared defaults.
      </P>
      <Example
        title="Maximize a pane"
        caption="maximize() grows the editor to its resolved max and reports the size it landed at; reset() restores the declared layout."
        whatToTry={[
          "Maximize the editor",
          "Reset back to defaults",
          "Narrow the frame, then maximize again",
        ]}
        source={maximizeSource}
      >
        <Maximize />
      </Example>

      <H2 id="group-apiref">Drive a whole group with apiRef</H2>
      <P>
        A group&rsquo;s <Code>apiRef</Code> is a <Code>PanelGroupApi</Code> that
        reads and writes the entire layout at once, keyed by{" "}
        <Code>panelId</Code>. Only panels that carry a <Code>panelId</Code>{" "}
        appear in the value; anonymous panels stay resizable but invisible here.
      </P>
      <Pre lang="ts">{`type PanelGroupApi = {
  getValue(): PanelGroupValue;         // { [panelId]: { size, collapsed? } }
  setValue(value: PanelGroupValue): void;
  resetValue(): void;
};`}</Pre>
      <P>
        <Code>setValue</Code> has <strong>replacement</strong> semantics, not
        merge: unknown keys are ignored, sizes reconcile to live bounds, and any
        mounted key you leave out falls back to that panel&rsquo;s declarative
        defaults. To nudge one panel and leave the rest, prefer that
        panel&rsquo;s own <Code>setSize</Code>. <Code>resetValue</Code> restores{" "}
        <Code>defaultValue</Code> when the group supplies one, otherwise the
        current declarative child defaults — a value restored from{" "}
        <DocLink to="/docs/persistence">persistence</DocLink> is never the reset
        baseline.
      </P>
      <Example
        title="Group apiRef"
        caption="A PanelGroupApi reads and replaces the entire layout value at once, keyed by panelId."
        whatToTry={[
          "Read the value, then set one",
          "Set collapsed, then reset",
        ]}
        source={groupApiRefSource}
      >
        <GroupApiRef />
      </Example>

      <H2 id="dispatch-by-locator">Dispatch by locator, without a ref</H2>
      <P>
        Call <Code>usePanelActions()</Code> anywhere under a provider and you
        get a <Code>PanelActionDispatcher</Code>. It carries the same actions as
        an <Code>apiRef</Code>, except every panel method takes a{" "}
        <Code>PanelLocator</Code> — the <Code>{"{ groupId, panelId }"}</Code>{" "}
        address of the panel — as its first argument. The buttons below each
        target a panel by name.
      </P>
      <Example
        title="A dispatch toolbar"
        caption="The toolbar commands panels by locator without subscribing, so a drag never bumps its render count; a stale locator returns not-found."
        whatToTry={[
          "Collapse and expand panels by name",
          "Drag a seam — count holds",
          "Dispatch to the ghost locator",
        ]}
        source={dispatchToolbarSource}
      >
        <DispatchToolbar />
      </Example>
      <P>
        The dispatcher subscribes to nothing. It is the same object for the
        provider&rsquo;s whole lifetime, so you can read it once in a handler
        without adding it to dependency arrays and without re-rendering when
        panels move — dispatching is a one-way call, not a subscription. That
        makes it the right hook for controls that only send commands; to{" "}
        <em>read</em> a panel&rsquo;s live state instead, reach for the{" "}
        <DocLink to="/docs/reading-state">read hooks</DocLink>. Targets resolve
        at call time: the dispatcher does not care whether a panel is mounted
        when you obtain it, only when you call a method. For a panel to be
        addressable, its group needs a published <Code>groupId</Code> and the
        panel a <Code>panelId</Code> — see{" "}
        <DocLink to="/docs/provider-and-hooks">providers and locators</DocLink>{" "}
        for how those two strings form the address.
      </P>
      <P>
        Because targets resolve at call time, a locator can point at nothing — a
        wrong <Code>groupId</Code>, a <Code>panelId</Code> that does not exist,
        or a group that has not mounted yet. Dispatching to it does not throw.
        Each panel method returns a <Code>PanelLookupActionResult</Code>: the
        ordinary <Code>PanelActionResult</Code> arms plus one extra{" "}
        <Code>not-found</Code> arm for the miss, so a handler can branch on it
        instead of assuming the panel is there.
      </P>
      <Pre lang="ts">{`type PanelLookupActionResult<TValue, TDetails> =
  | PanelActionResult<TValue, TDetails>       // applied, unchanged, or rejected
  | { applied: false; reason: "not-found" };  // locator did not resolve`}</Pre>

      <H2 id="group-commands">Group-scoped dispatcher commands</H2>
      <P>
        Beyond per-panel actions, the <Code>PanelActionDispatcher</Code> can
        read and set a whole group&rsquo;s value by <Code>groupId</Code>. These
        mirror a group&rsquo;s <Code>apiRef</Code>, so you can drive layout from
        a toolbar outside the group without wiring a ref:
      </P>
      <Pre lang="ts">{`getGroupValue(groupId: string): PanelGroupValue | undefined;
setGroupValue(groupId: string, value: PanelGroupValue): PanelGroupCommandResult;
resetGroupValue(groupId: string): PanelGroupCommandResult;`}</Pre>
      <P>
        The read and the commands are deliberately asymmetric.{" "}
        <Code>getGroupValue</Code> is a plain read: it returns the group&rsquo;s{" "}
        <Code>PanelGroupValue</Code>, or <Code>undefined</Code> when that{" "}
        <Code>groupId</Code> is not published. The two mutators return a{" "}
        <Code>PanelGroupCommandResult</Code> — a result object, not a bare
        value:
      </P>
      <Pre lang="ts">{`type PanelGroupCommandResult =
  | { applied: true;  value: PanelGroupValue }
  | { applied: false; reason: "unchanged"; value: PanelGroupValue }
  | { applied: false; reason: "not-found" };`}</Pre>
      <P>
        A group command carries no panel-level rejection reasons — unknown keys
        are ignored and sizes reconcile to live bounds — so the only way it
        fails is <Code>not-found</Code>, an unpublished or unmounted{" "}
        <Code>groupId</Code>. <Code>setGroupValue</Code> replaces the value
        (omitted mounted panels fall back to their declarative defaults), and{" "}
        <Code>resetGroupValue</Code> restores the group&rsquo;s{" "}
        <Code>defaultValue</Code> if it has one, otherwise its child defaults.
      </P>
      <Example
        title="Reading and commanding a group"
        caption="getGroupValue reads a group's value; setGroupValue and resetGroupValue return a PanelGroupCommandResult."
        whatToTry={[
          "Read the group, then a miss",
          "Set a wide layout, then reset",
        ]}
        source={groupCommandsSource}
      >
        <GroupCommands />
      </Example>

      <H2 id="results">Reading action results</H2>
      <P>
        Actions are authoritative: they report the accepted value, never the raw
        request. Every panel action returns a <Code>PanelActionResult</Code>{" "}
        with one of three shapes. Check <Code>applied</Code> first, then{" "}
        <Code>reason</Code>.
      </P>
      <Pre lang="ts">{`type PanelActionResult<TValue, TDetails = {}> =
  | ({ applied: true;  value: TValue } & TDetails)                       // change
  | ({ applied: false; reason: "unchanged"; value: TValue } & TDetails)  // no-op
  | { applied: false; reason: PanelActionRejectionReason };              // rejected`}</Pre>
      <Table
        headers={["Result", "Carries", "Notes"]}
        rows={[
          [
            "applied: true",
            <Code>value + details</Code>,
            <>
              The action changed something. <Code>value</Code> is the accepted
              result. In controlled mode this only means the change was{" "}
              <em>emitted</em> as a proposal (see the callout below).
            </>,
          ],
          [
            'applied: false, reason: "unchanged"',
            <Code>value + details</Code>,
            <>
              A no-op: nothing moved, but it still carries the current{" "}
              <Code>value</Code> and any details. A no-op can still be{" "}
              <Code>constrained: true</Code>.
            </>,
          ],
          [
            "applied: false, reason: <rejection>",
            <Code>no value</Code>,
            <>
              Rejected outright, no state touched. The{" "}
              <Code>PanelActionRejectionReason</Code> is one of{" "}
              <Code>disabled</Code>, <Code>not-collapsible</Code>,{" "}
              <Code>invalid-size</Code>. There is no <Code>value</Code> to read.
            </>,
          ],
        ]}
      />
      <P>
        Size-producing actions (<Code>setSize</Code>, <Code>maximize</Code>) add{" "}
        <Code>PanelSizeActionDetails</Code> —{" "}
        <Code>{`{ constrained: boolean }`}</Code> — telling you whether bounds
        or group allocation trimmed the request. In the demo below,{" "}
        <Code>setSize(9999)</Code> applies but comes back{" "}
        <Code>constrained: true</Code> with the clamped value; pressing the same
        button again is an <Code>unchanged</Code> no-op that is still{" "}
        <Code>constrained</Code>; and <Code>setSize("240")</Code> — a bare
        numeric string, which the{" "}
        <DocLink to="/docs/sizing">
          <Code>SizeSpec</Code> grammar
        </DocLink>{" "}
        rejects — comes back <Code>invalid-size</Code> with no value.
      </P>
      <Example
        title="Reading results"
        caption="Actions report the accepted value; setSize(9999) clamps and comes back constrained: true."
        whatToTry={[
          "Run setSize(9999), then run it again",
          'Try setSize("240") — rejected',
          "Switch the transition mode",
        ]}
        source={readingResultsSource}
      >
        <ReadingResults />
      </Example>
      <Callout
        variant="warning"
        title="applied: true is not “the panel is now this size”"
      >
        For an uncontrolled group the change renders and persists. For a{" "}
        <DocLink to="/docs/controlled-state">controlled group</DocLink> it means
        the change was emitted as a proposal through <Code>onValueChange</Code>{" "}
        — the parent still owns <Code>value</Code> and may decline it. Read{" "}
        <Code>applied</Code> as &ldquo;the command resolved&rdquo;, not
        &ldquo;the layout updated&rdquo;. The same holds for the dispatcher and
        for <Code>PanelGroupCommandResult</Code>.
      </Callout>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        The getters on a <Code>PanelApi</Code> are snapshots — sampling them in
        render will not re-run when the panel moves; subscribe with the{" "}
        <DocLink to="/docs/reading-state">read hooks</DocLink> if a control must
        reflect live state. Group-scoped commands do not take{" "}
        <Code>PanelActionOptions</Code>: only the per-panel methods accept the{" "}
        <Code>{`{ transition }`}</Code> argument. And an unresolved locator is
        never an exception — <Code>not-found</Code> is a normal arm you branch
        on, so always test <Code>applied</Code> before reading{" "}
        <Code>value</Code>. For the collapse gesture behind{" "}
        <Code>collapse</Code> and <Kbd>Enter</Kbd>, see{" "}
        <DocLink to="/docs/collapsing">collapsing</DocLink>.
      </P>

      <Related
        items={[
          {
            to: "/docs/reading-state",
            label: "Reading state with hooks",
            note: "the subscribing counterpart, for controls that reflect live state",
          },
          {
            to: "/docs/controlled-state",
            label: "Controlled state & events",
            note: "what applied: true promises when the parent owns value",
          },
          {
            to: "/docs/provider-and-hooks",
            label: "Providers & locators",
            note: "how a group and panel publish an addressable locator",
          },
          {
            to: "/docs/action-types",
            label: "Action & API types",
            note: "the full type signatures behind every action and result",
          },
        ]}
      />
    </div>
  );
}
