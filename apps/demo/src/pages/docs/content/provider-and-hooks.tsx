import SharedProvider from "../examples/provider-and-hooks/shared-provider";
import sharedProviderSource from "../examples/provider-and-hooks/shared-provider.tsx?raw";
import TwoGroupsOneProvider from "../examples/provider-and-hooks/two-groups-one-provider";
import twoGroupsOneProviderSource from "../examples/provider-and-hooks/two-groups-one-provider.tsx?raw";
import {
  Code,
  DocLink,
  Example,
  H2,
  P,
  Pre,
  Related,
  Req,
  Table,
} from "../primitives";

export function ProviderAndHooksDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        <Code>PanelProvider</Code> is the explicit boundary that lets code
        address panels by <Code>PanelLocator</Code> — from a toolbar outside the
        group, or across sibling groups that must share one lookup namespace.
        Every standalone <Code>PanelGroup</Code> installs one implicitly, so you
        reach for the explicit provider only when the implicit one is not
        enough.
      </P>

      <Example
        title="Shared provider"
        caption="One PanelProvider lets a toolbar outside the group address the sidebar by locator."
        whatToTry={["Toggle from the outside button", "Watch the label flip"]}
        source={sharedProviderSource}
      >
        <SharedProvider />
      </Example>

      <H2 id="props">Props</H2>
      <P>
        The provider carries no configuration — it exists only to hold the
        boundary. The full type is <Code>PanelProviderProps</Code>, and its one
        member is the tree it wraps. <Code>PanelProvider</Code> renders no host
        element of its own, so there are no <Code>className</Code>,{" "}
        <Code>style</Code>, or <Code>div</Code> attributes to forward.
      </P>
      <Table
        rows={[
          [
            "children",
            <Code>ReactNode</Code>,
            <>
              <Req /> The groups and any external controls that should share one
              lookup namespace. Wrap both the caller and the group(s) so a
              control outside a group can reach it.
            </>,
          ],
        ]}
      />

      <H2 id="when-you-need-it">When the implicit provider is not enough</H2>
      <P>
        A standalone <Code>PanelGroup</Code> wraps itself in a provider
        automatically, and that implicit boundary serves every caller inside the
        group&rsquo;s subtree — which is why hooks and the dispatcher work with
        no setup for a control rendered <em>inside</em> the group. Its limit is
        the subtree. Two cases fall outside it:
      </P>
      <P>
        <strong>External toolbars.</strong> A control rendered as a{" "}
        <em>sibling</em> of the group — a header button, a status bar, a menu —
        sits outside the group&rsquo;s subtree and cannot see its panels. The
        toolbar in the hero example is exactly this: it lives beside the{" "}
        <Code>PanelGroup</Code>, not within it, and reaches the sidebar only
        because one explicit <Code>PanelProvider</Code> wraps both.
      </P>
      <P>
        <strong>Sibling groups.</strong> Two standalone groups get two{" "}
        <em>independent</em> implicit providers, so a dispatcher obtained in one
        cannot reach the other. Wrap both in a single <Code>PanelProvider</Code>{" "}
        to make one namespace span both. Nesting an explicit provider inside
        another is a deliberate isolation boundary — the nearest provider wins,
        and the inner group&rsquo;s panels stay invisible to callers outside it.
        Detection reads React context only, never the DOM, so the same boundary
        resolves identically on the server and in the browser.
      </P>

      <H2 id="the-locator">The locator</H2>
      <P>
        A <Code>PanelLocator</Code> is the exact address of one panel: the{" "}
        <Code>groupId</Code> its group published plus the panel&rsquo;s
        group-local <Code>panelId</Code>. Both strings are mandatory.
      </P>
      <Pre lang="ts">{`type PanelLocator = {
  groupId: string; // the group's published groupId
  panelId: string; // the panel's group-local panelId
};`}</Pre>
      <P>
        Lookup is <strong>exact match, no fallback</strong>. A locator with the
        wrong <Code>groupId</Code> resolves to nothing rather than guessing at
        another group&rsquo;s panel, so mount order can never decide the target.
        For a panel to be addressable its group must set a <Code>groupId</Code>{" "}
        and the panel must set a <Code>panelId</Code>: a group with no{" "}
        <Code>groupId</Code> stays private to its own subtree, and an anonymous
        panel is invisible to every locator-keyed API. The locator is what{" "}
        <Code>usePanelControls</Code>, <Code>usePanelCollapsed</Code>, and every
        panel method on the <Code>usePanelActions</Code> dispatcher take as
        their target.
      </P>

      <H2 id="two-groups">Two groups, one provider</H2>
      <P>
        Put two groups under one provider and a single dispatcher can target
        either. Both groups below contain a panel named{" "}
        <Code>panelId="aside"</Code> — the same panel name in each. The name
        alone is ambiguous, so the <Code>groupId</Code> is what decides which
        one a button hits.
      </P>
      <Example
        title="Two groups, one provider"
        caption="With two groups sharing a provider, the groupId decides which same-named panel a button hits."
        whatToTry={[
          "Toggle each — only its group reacts",
          'Both asides share panelId "aside"',
        ]}
        source={twoGroupsOneProviderSource}
        frameClassName="h-72"
      >
        <TwoGroupsOneProvider />
      </Example>
      <P>
        Each button dispatches to a locator that differs only in{" "}
        <Code>groupId</Code>. Because lookup never falls back across groups,
        both fields are required and the target is never ambiguous.
      </P>

      <H2 id="hooks">Hooks</H2>
      <P>
        Six hooks read and drive panels through the provider boundary. Each is
        taught in full on its owning guide; this table is the signature lookup.
        The locator-keyed reads return <Code>undefined</Code> until the target
        resolves, and every hook throws when called outside any provider.
      </P>
      <Table
        headers={["Hook", "Signature", "Purpose"]}
        rows={[
          [
            "usePanelControls",
            <Code>(target: PanelLocator) =&gt; PanelControls | undefined</Code>,
            <>
              One panel&rsquo;s full live controls — size, collapsed flag,
              constraints.{" "}
              <DocLink to="/docs/reading-state">Reading state</DocLink>.
            </>,
          ],
          [
            "usePanelCollapsed",
            <Code>(target: PanelLocator) =&gt; boolean | undefined</Code>,
            <>
              Only the collapsed flag; skips every size-drag frame.{" "}
              <DocLink to="/docs/reading-state">Reading state</DocLink>.
            </>,
          ],
          [
            "usePanelRegistry",
            <Code>
              (groupId: string) =&gt; Record&lt;string, PanelControls&gt;
            </Code>,
            <>
              Every named panel in one group, keyed by <Code>panelId</Code>.{" "}
              <DocLink to="/docs/reading-state">Reading state</DocLink>.
            </>,
          ],
          [
            "usePanelGroupState",
            <Code>(groupId: string) =&gt; PanelGroupState | undefined</Code>,
            <>
              One group&rsquo;s measured <Code>containerSize</Code> and fit —
              breakpoint on the container.{" "}
              <DocLink to="/docs/reading-state">Reading state</DocLink>.
            </>,
          ],
          [
            "usePanelInteractionState",
            <Code>
              () =&gt; {"{ isPointerDragging, isContainerResizing }"}
            </Code>,
            <>
              Provider-wide drag and container-resize activity; no locator.{" "}
              <DocLink to="/docs/reading-state">Reading state</DocLink>.
            </>,
          ],
          [
            "usePanelActions",
            <Code>() =&gt; PanelActionDispatcher</Code>,
            <>
              The write side: a locator-keyed dispatcher that never subscribes.{" "}
              <DocLink to="/docs/imperative-and-actions">
                Driving panels
              </DocLink>
              .
            </>,
          ],
        ]}
      />

      <H2 id="gotchas">Gotchas</H2>
      <P>
        <strong>Duplicate groupId.</strong> Publishing two groups under the same{" "}
        <Code>groupId</Code> in one provider warns —{" "}
        <Code>
          Duplicate groupId "…" within one &lt;PanelProvider&gt;. Each published
          group must have a unique groupId; lookup resolves the first mounted
          group.
        </Code>{" "}
        Locators resolve the first mounted group and the later publisher becomes
        unreachable, so give each group its own <Code>groupId</Code>.
      </P>
      <P>
        <strong>Unpublished groups and anonymous panels.</strong> A group with
        no <Code>groupId</Code> and a panel with no <Code>panelId</Code> are
        never resolvable — the locator reads return <Code>undefined</Code> and
        the <Code>usePanelActions</Code> dispatcher returns{" "}
        <Code>{'{ applied: false, reason: "not-found" }'}</Code> rather than
        throwing. A read that stays <Code>undefined</Code> usually means the
        group has not published its <Code>groupId</Code> yet, or the locator
        names a panel that does not exist.
      </P>
      <P>
        <strong>No provider at all.</strong> Calling any of these hooks with no
        implicit or explicit provider above them throws with an actionable
        message. If a hook throws about a missing provider, you are calling it
        outside every group and outside any explicit <Code>PanelProvider</Code>{" "}
        — wrap the caller and the group in one.
      </P>

      <Related
        items={[
          {
            to: "/docs/reading-state",
            label: "Reading state with hooks",
            note: "the five read hooks the locator feeds",
          },
          {
            to: "/docs/imperative-and-actions",
            label: "Driving panels from code",
            note: "usePanelActions and the apiRef handles",
          },
          {
            to: "/docs/provider-hook-types",
            label: "Provider & hook types",
            note: "PanelLocator, PanelControls, and the dispatcher shapes",
          },
        ]}
      />
    </div>
  );
}
