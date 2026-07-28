import { createContext, type ReactNode, useContext } from "react";
import { Code, DocLink, H2, P, Pre, Related } from "../primitives";
import {
  TYPE_CATEGORY_BY_NAME,
  TYPE_REFERENCE_COPY,
  type TypeName,
  type TypeReferenceCategory,
} from "./type-reference";

const TypeReferenceCategoryContext =
  createContext<TypeReferenceCategory>("component-props");

/**
 * One entry in a focused type-reference page: a name (which becomes the
 * on-page TOC anchor), its signature, a short meaning, and its teaching page.
 */
function TypeEntry({
  name,
  signature,
  to,
  teaches,
  children,
}: {
  name: TypeName;
  signature: string;
  to: string;
  teaches: string;
  children: ReactNode;
}) {
  const category = useContext(TypeReferenceCategoryContext);
  if (TYPE_CATEGORY_BY_NAME[name] !== category) return null;

  return (
    <div className="flex flex-col gap-2">
      <H2 id={name.toLowerCase()}>{name}</H2>
      <Pre lang="ts">{signature}</Pre>
      <P>
        {children} Taught on <DocLink to={`/docs/${to}`}>{teaches}</DocLink>.
      </P>
    </div>
  );
}

export function ComponentPropsTypesDoc() {
  return <TypesDoc category="component-props" />;
}

export function LayoutTypesDoc() {
  return <TypesDoc category="layout-types" />;
}

export function ValueEventTypesDoc() {
  return <TypesDoc category="value-event-types" />;
}

export function ActionTypesDoc() {
  return <TypesDoc category="action-types" />;
}

export function ProviderHookTypesDoc() {
  return <TypesDoc category="provider-hook-types" />;
}

export function PersistenceTypesDoc() {
  return <TypesDoc category="persistence-types" />;
}

function TypesDoc({ category }: { category: TypeReferenceCategory }) {
  return (
    <TypeReferenceCategoryContext.Provider value={category}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <P>
            {TYPE_REFERENCE_COPY[category]} Each entry gives the exact public
            signature and links to the guide that teaches its runtime behavior
            in context.
          </P>
          <P>
            Use the <em>On this page</em> rail to jump directly to a symbol.
            Entries stay alphabetical within this reference area.
          </P>
        </div>

        <TypeEntry
          name="DockedPanelProps"
          to="panel"
          teaches="Panel"
          signature={`type DockedPanelProps = PanelBaseProps &
  PanelCollapsedStateProps & {
    side: PanelSide;
    defaultSize: SizeSpec;
    pinned?: boolean;
  };`}
        >
          The docked arm of <Code>PanelProps</Code>: <Code>side</Code> and{" "}
          <Code>defaultSize</Code> are required, and <Code>pinned</Code> is
          docked-only. The shared base props and the collapsed-state arm are
          listed on the Panel page.
        </TypeEntry>

        <TypeEntry
          name="PanelActionDispatcher"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelActionDispatcher = {
  // every panel method takes a PanelLocator first and returns
  // the PanelLookupActionResult variant (adds "not-found")
  setSize(target: PanelLocator, size: SizeSpec, options?: PanelActionOptions):
    PanelLookupActionResult<number, PanelSizeActionDetails>;
  maximize(target, options?): PanelLookupActionResult<number, PanelSizeActionDetails>;
  setCollapsed(target, collapsed, options?): PanelLookupActionResult<boolean>;
  collapse(target, options?): PanelLookupActionResult<true>;
  expand(target, options?): PanelLookupActionResult<false>;
  toggle(target, options?): PanelLookupActionResult<boolean>;
  reset(target, options?): PanelLookupActionResult<PanelValue>;
  // group-scoped commands
  getGroupValue(groupId: string): PanelGroupValue | undefined;
  setGroupValue(groupId: string, value: PanelGroupValue): PanelGroupCommandResult;
  resetGroupValue(groupId: string): PanelGroupCommandResult;
};`}
        >
          The locator-keyed dispatcher returned by{" "}
          <Code>usePanelActions()</Code>. Panel methods mirror{" "}
          <Code>PanelActions</Code> but take a <Code>PanelLocator</Code> first;
          three group-scoped commands mirror the group API without an{" "}
          <Code>apiRef</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelActionOptions"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelActionOptions = Readonly<{
  transition?: "default" | "none";
}>;`}
        >
          Options accepted by every imperative action. <Code>"none"</Code>{" "}
          applies the change without the size transition.
        </TypeEntry>

        <TypeEntry
          name="PanelActionRejectionReason"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelActionRejectionReason =
  | "disabled"
  | "not-collapsible"
  | "invalid-size";`}
        >
          Why an action was rejected outright — no state was touched. Appears in
          the rejection arm of <Code>PanelActionResult</Code>, which carries no{" "}
          <Code>value</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelActionResult"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelActionResult<
  TValue,
  TDetails extends object = Record<never, never>,
> =
  | ({ applied: true;  value: TValue } & TDetails)
  | ({ applied: false; reason: "unchanged"; value: TValue } & TDetails)
  | { applied: false; reason: PanelActionRejectionReason }; // no value`}
        >
          The synchronous outcome of an imperative panel action.{" "}
          <Code>value</Code> is the accepted value, never the raw request; in
          controlled mode <Code>applied: true</Code> means the change was
          emitted as a proposal, not that the panel is now that size.
        </TypeEntry>

        <TypeEntry
          name="PanelActions"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelActions = {
  setSize: (size: SizeSpec, options?: PanelActionOptions) =>
    PanelActionResult<number, PanelSizeActionDetails>;
  maximize: (options?: PanelActionOptions) =>
    PanelActionResult<number, PanelSizeActionDetails>;
  setCollapsed: (collapsed: boolean, options?: PanelActionOptions) =>
    PanelActionResult<boolean>;
  collapse: (options?: PanelActionOptions) => PanelActionResult<true>;
  expand: (options?: PanelActionOptions) => PanelActionResult<false>;
  toggle: (options?: PanelActionOptions) => PanelActionResult<boolean>;
  reset: (options?: PanelActionOptions) => PanelActionResult<PanelValue>;
};`}
        >
          The bound action set shared by <Code>PanelApi</Code> and{" "}
          <Code>PanelControls</Code>. Each action returns an authoritative{" "}
          <Code>PanelActionResult</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelApi"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelApi = PanelActions & {
  isCollapsed: () => boolean;
  getSize: () => number;         // current preferred size, px
  getRenderedSize: () => number; // current rendered size, px
};`}
        >
          The <Code>apiRef</Code> controller for a mounted panel: bound{" "}
          <Code>PanelActions</Code> plus non-reactive getters that return
          current values in pixels. Getters are snapshots — call them when you
          need a value, don't cache. <Code>isCollapsed()</Code> reports the
          effective state, so a panel with a controlled <Code>collapsed</Code>{" "}
          prop reports the prop.
        </TypeEntry>

        <TypeEntry
          name="PanelChangeDetails"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelChangeDetails = {
  reason: PanelValueChangeReason;
  trigger: PanelValueChangeTrigger;
};`}
        >
          Metadata delivered with a panel's <Code>onSizeChange</Code> and{" "}
          <Code>onCollapsedChange</Code> callbacks. With a controlled{" "}
          <Code>collapsed</Code> prop, <Code>onCollapsedChange</Code> becomes
          the proposal channel and these details describe the proposed change.
        </TypeEntry>

        <TypeEntry
          name="PanelCollapseBelowBehavior"
          to="collapsing"
          teaches="Collapsing"
          signature={`type PanelCollapseBelowBehavior = "animated" | "instant";`}
        >
          How a panel closes when a pointer resize crosses{" "}
          <Code>collapseBelow</Code>. Defaults to <Code>"animated"</Code>; has
          no effect without <Code>collapseBelow</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelContainerResizeBehavior"
          to="sizing"
          teaches="Sizing"
          signature={`type PanelContainerResizeBehavior = "fixed" | "proportional";`}
        >
          How an expanded panel responds when its parent group's size changes.
          Defaults to <Code>"fixed"</Code> for docked panels,{" "}
          <Code>"proportional"</Code> for peers.
        </TypeEntry>

        <TypeEntry
          name="PanelControlConstraints"
          to="reading-state"
          teaches="Reading state with hooks"
          signature={`type PanelControlConstraints = {
  minSize: number;
  maxSize: number;
  collapsedSize: number;
};`}
        >
          A panel's live bound facts in resolved pixels, for building a control
          UI. A field of <Code>PanelControls</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelControls"
          to="reading-state"
          teaches="Reading state with hooks"
          signature={`type PanelControls = PanelActions & {
  orientation: PanelGroupOrientation;
  size: number;          // preferred, px
  renderedSize: number;  // currently rendered, px
  collapsed: boolean;
  collapsible: boolean;
  disabled: boolean;
  isReady: boolean;
  constraints: PanelControlConstraints;
} & ({ kind: "docked"; side: PanelSide } | { kind: "peer"; side?: never });`}
        >
          One panel's live state plus bound actions, from{" "}
          <Code>usePanelControls</Code> / <Code>usePanelRegistry</Code>.
          Discriminated on <Code>kind</Code>: docked carries a <Code>side</Code>
          , peer does not. <Code>collapsed</Code> is the effective state — for a
          panel with a controlled <Code>collapsed</Code> prop, that is the prop.
        </TypeEntry>

        <TypeEntry
          name="PanelCursorBehavior"
          to="panel-group"
          teaches="Panel group"
          signature={`type PanelCursorBehavior = "global" | "handle" | "none";`}
        >
          A group's cursor policy during a pointer resize. The{" "}
          <Code>PanelGroup</Code> default is <Code>"global"</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupAnimation"
          to="panel-group"
          teaches="Panel group"
          signature={
            "type PanelGroupAnimation =\n  | false\n  | {\n      durationMs?: number;\n      easing?: string;\n    };"
          }
        >
          Group-level control for library-owned panel transitions and the
          collapse-threshold spring. <Code>false</Code> disables them; an object
          overrides the default duration or easing. Nested groups own their
          animation independently.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupApi"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelGroupApi = {
  getValue: () => PanelGroupValue;
  setValue: (value: PanelGroupValue) => void;
  resetValue: () => void;
};`}
        >
          The <Code>apiRef</Code> controller for a group. <Code>setValue</Code>{" "}
          is a replacement: unknown keys ignored, omitted mounted keys restored
          to declarative defaults, sizes reconciled to live bounds.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupCascade"
          to="sizing"
          teaches="Sizing"
          signature={'type PanelGroupCascade = "reversible" | "latching";'}
        >
          A group's mid-drag cascade reversal policy, defaulting to{" "}
          <Code>"reversible"</Code>: reversing the pointer retraces the
          session-start allocation. <Code>"latching"</Code> preserves one-way
          pushes within that held drag. Across sessions the two are identical —
          sizes commit on release.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupCommandResult"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelGroupCommandResult =
  | { applied: true;  value: PanelGroupValue }
  | { applied: false; reason: "unchanged"; value: PanelGroupValue }
  | { applied: false; reason: "not-found" };`}
        >
          The result of a group-scoped dispatcher command. Group commands can't
          be rejected for panel-level reasons, so the only failure is{" "}
          <Code>not-found</Code> (an unpublished or unmounted{" "}
          <Code>groupId</Code>
          ).
        </TypeEntry>

        <TypeEntry
          name="PanelGroupOrientation"
          to="panel-group"
          teaches="Panel group"
          signature={`type PanelGroupOrientation = "horizontal" | "vertical";`}
        >
          A group's main layout axis.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupPersistenceOptions"
          to="persistence"
          teaches="Persistence"
          signature={`type PanelGroupPersistenceOptions = {
  key: string;
  storage?: PanelStorage;                            // default localStorage
  onError?: (error: PanelPersistenceError) => void;
  onStatusChange?: (status: PanelPersistenceStatus) => void;
};`}
        >
          The config passed to <Code>{`<PanelGroup persistence>`}</Code>.
          Mutually exclusive with a controlled <Code>value</Code>. Only the
          stable <Code>key</Code> and <Code>storage</Code> fields key the
          machinery; callbacks route through a ref, so a fresh literal each
          render is harmless.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupProps"
          to="panel-group"
          teaches="Panel group"
          signature={`type PanelGroupProps = PanelGroupBaseProps &
  (ControlledPanelGroupStateProps | UncontrolledPanelGroupStateProps);`}
        >
          Props for <Code>PanelGroup</Code>. The union enforces{" "}
          <Code>value</Code> XOR <Code>defaultValue</Code> at the type level;
          the full prop list is on the Panel group page.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupState"
          to="reading-state"
          teaches="Reading state with hooks"
          signature={`type PanelGroupState = {
  containerSize: number;
  measured: boolean;
  overconstrainedBy: number;
  unallocatedPx: number;
};`}
        >
          One published group's live layout condition, returned by{" "}
          <Code>usePanelGroupState</Code>: its measured{" "}
          <Code>containerSize</Code>, whether it has <Code>measured</Code> yet,
          and the <Code>overconstrainedBy</Code> / <Code>unallocatedPx</Code>{" "}
          shortfalls. The signal a parent reads to breakpoint on the container —
          swap a panel for a sheet, drop to tabs — instead of the viewport.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupValue"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelGroupValue = Readonly<Record<string, PanelValue>>;`}
        >
          A group's controlled/uncontrolled state, keyed by group-local{" "}
          <Code>panelId</Code>. Anonymous panels never appear, and key order
          carries no meaning — React children own visual order.
        </TypeEntry>

        <TypeEntry
          name="PanelGroupValueChangeDetails"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelGroupValueChangeDetails = {
  previousValue: PanelGroupValue;
  reason: PanelValueChangeReason;
  trigger: PanelValueChangeTrigger;
  handleId?: string;
};`}
        >
          Metadata delivered with every <Code>onValueChange</Code>.{" "}
          <Code>previousValue</Code> is the prior emitted value; the first
          change of a pointer transaction uses that transaction's start value as
          its baseline.
        </TypeEntry>

        <TypeEntry
          name="PanelKind"
          to="mental-model"
          teaches="Mental model"
          signature={`type PanelKind = "docked" | "peer";`}
        >
          The discriminator between the two kinds of panel: docked panels anchor
          to an edge with their own size; peers share space proportionally.
        </TypeEntry>

        <TypeEntry
          name="PanelLocator"
          to="provider-and-hooks"
          teaches="PanelProvider & hooks"
          signature={`type PanelLocator = { groupId: string; panelId: string };`}
        >
          The exact address of one panel for provider-level lookup. Both fields
          are required; lookup never falls back across groups.
        </TypeEntry>

        <TypeEntry
          name="PanelLookupActionResult"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelLookupActionResult<
  TValue,
  TDetails extends object = Record<never, never>,
> =
  | PanelActionResult<TValue, TDetails>
  | { applied: false; reason: "not-found" };`}
        >
          The dispatcher's result variant — a <Code>PanelActionResult</Code>{" "}
          plus <Code>not-found</Code> for a locator that doesn't resolve.
          Returned by every panel method of <Code>PanelActionDispatcher</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelPersistenceError"
          to="persistence"
          teaches="Persistence"
          signature={`type PanelPersistenceError = {
  operation: "read" | "deserialize" | "write";
  key: string;
  error: unknown;
};`}
        >
          A failure reported through <Code>persistence.onError</Code>.{" "}
          <Code>read</Code> and <Code>deserialize</Code> failures keep the
          declarative fallback and are reported once per restore attempt.
        </TypeEntry>

        <TypeEntry
          name="PanelPersistenceStatus"
          to="persistence"
          teaches="Persistence"
          signature={`type PanelPersistenceStatus =
  | { state: "restoring"; key: string }
  | { state: "ready"; key: string };`}
        >
          The restore lifecycle reported through{" "}
          <Code>persistence.onStatusChange</Code>: <Code>restoring</Code> when
          the mount-time read begins, <Code>ready</Code> exactly once after it
          succeeds, finds nothing, or fails.
        </TypeEntry>

        <TypeEntry
          name="PanelProps"
          to="panel"
          teaches="Panel"
          signature={`type PanelProps = DockedPanelProps | PeerPanelProps;

// both arms carry the collapsed-state union:
type PanelCollapsedStateProps =
  | { collapsed: boolean;   defaultCollapsed?: never }
  | { collapsed?: never;    defaultCollapsed?: boolean };`}
        >
          The discriminated public prop type for <Code>Panel</Code>. The
          presence of <Code>side</Code> chooses the docked arm; its absence
          chooses peer. Both arms enforce <Code>collapsed</Code> XOR{" "}
          <Code>defaultCollapsed</Code> at the type level, so a panel is either
          controlled or uncontrolled for its collapsed state.
        </TypeEntry>

        <TypeEntry
          name="PanelProviderProps"
          to="provider-and-hooks"
          teaches="PanelProvider & hooks"
          signature={`type PanelProviderProps = { children: ReactNode };`}
        >
          Props for <Code>PanelProvider</Code>. You only need an explicit
          provider to reach panels from outside a group or to share lookup
          across sibling groups.
        </TypeEntry>

        <TypeEntry
          name="PanelResizeEndEvent"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelResizeEndEvent = {
  handleId?: string;
  initialValue: PanelGroupValue; // baseline at transaction start
  value: PanelGroupValue;        // final value when the session ended
  canceled: boolean;             // ended via cancel/lost-capture/exception
};`}
        >
          The end of a pointer resize transaction — fires exactly once per
          session, including cancel, lost capture, blur, unmount, and exception
          paths (<Code>canceled: true</Code>).
        </TypeEntry>

        <TypeEntry
          name="PanelResizeHandleProps"
          to="panel-resize-handle"
          teaches="PanelResizeHandle"
          signature={`type PanelResizeHandleProps =
  Omit<HTMLAttributes<HTMLDivElement>, "role" | "tabIndex"> & {
    handleId?: string;
    disabled?: boolean;
    keyboardStep?: number;
    keyboardStepFine?: number;
    keyboardStepCoarse?: number;
    hitAreaMargins?: { coarse?: number; fine?: number };
    gutterSize?: number;
    doubleClickReset?: "before" | "after" | false;
  };`}
        >
          Props for <Code>PanelResizeHandle</Code>. It forwards native{" "}
          <Code>div</Code> props except <Code>role</Code> and{" "}
          <Code>tabIndex</Code>, which the library owns.
        </TypeEntry>

        <TypeEntry
          name="PanelResizeStartEvent"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelResizeStartEvent = {
  handleId?: string;
  value: PanelGroupValue; // group value at transaction start
};`}
        >
          The start of a pointer resize transaction. Keyboard actions are atomic
          value changes and emit no start/end lifecycle.
        </TypeEntry>

        <TypeEntry
          name="PanelSide"
          to="panel"
          teaches="Panel"
          signature={`type PanelSide = "start" | "end";`}
        >
          The logical group edge a docked panel anchors to. It follows the
          group's <Code>dir</Code>, so RTL flips the physical side.
        </TypeEntry>

        <TypeEntry
          name="PanelSizeActionDetails"
          to="imperative-and-actions"
          teaches="Driving panels from code"
          signature={`type PanelSizeActionDetails = { constrained: boolean };`}
        >
          Extra details on size-producing actions (<Code>setSize</Code>,{" "}
          <Code>maximize</Code>). <Code>constrained</Code> is true when bounds
          or group allocation prevented the full request — independent of
          whether any change occurred.
        </TypeEntry>

        <TypeEntry
          name="PanelSlotProps"
          to="panel"
          teaches="Panel"
          signature={`type PanelSlotProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;`}
        >
          <strong>Advanced.</strong> Props for one of a panel's{" "}
          <em>internal</em> wrapper elements, passed through{" "}
          <Code>PanelSlots</Code>. It forwards native <Code>div</Code> props
          except <Code>children</Code>, which the library owns. Root props still
          go directly on <Code>{`<Panel>`}</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelSlots"
          to="panel"
          teaches="Panel"
          signature={`type PanelSlots = {
  viewport?: PanelSlotProps; // the clipping + animation wrapper
  content?: PanelSlotProps;  // the element that owns your children
};`}
        >
          <strong>Advanced.</strong> The shape of a panel's{" "}
          <Code>slotProps</Code> prop, for styling or attributing its inner
          wrappers. Most layouts never touch it; reach for it only when root
          props on <Code>{`<Panel>`}</Code> aren't enough.
        </TypeEntry>

        <TypeEntry
          name="PanelStorage"
          to="persistence"
          teaches="Persistence"
          signature={`type PanelStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
};`}
        >
          A storage adapter mirroring Web Storage. <Code>localStorage</Code> and{" "}
          <Code>sessionStorage</Code> drop in directly; custom adapters
          (cookies, server, async) satisfy the same shape.
        </TypeEntry>

        <TypeEntry
          name="PanelValue"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelValue = Readonly<{ size: number; collapsed?: boolean }>;`}
        >
          One panel's semantic state inside a group value: the preferred
          expanded <Code>size</Code> in resolved pixels, plus{" "}
          <Code>collapsed</Code> for collapsible panels. Returned by{" "}
          <Code>reset()</Code>.
        </TypeEntry>

        <TypeEntry
          name="PanelValueChangeReason"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelValueChangeReason =
  | "resize" | "collapse" | "expand" | "set-value"
  | "reset" | "container-resize" | "restore" | "children";`}
        >
          What operation produced a change. Orthogonal to the input device that
          triggered it. Treat this union as open: keep a <Code>default</Code>{" "}
          case in any <Code>switch</Code>, so a future reason (or a
          system-driven auto-collapse) never breaks your handling.
        </TypeEntry>

        <TypeEntry
          name="PanelValueChangeTrigger"
          to="controlled-state"
          teaches="Controlled state & events"
          signature={`type PanelValueChangeTrigger = "pointer" | "keyboard" | "api" | "system";`}
        >
          What input produced a change. <Code>system</Code> covers container
          resize, persistence restoration, membership changes, and width-driven
          auto-collapse. Treat this union as open too &mdash; keep a{" "}
          <Code>default</Code> case.
        </TypeEntry>

        <TypeEntry
          name="PeerPanelProps"
          to="panel"
          teaches="Panel"
          signature={`type PeerPanelProps = PanelBaseProps &
  PanelCollapsedStateProps & {
    side?: never;
    pinned?: never;
  };`}
        >
          The peer arm of <Code>PanelProps</Code>: <Code>side</Code> and{" "}
          <Code>pinned</Code> are forbidden, and <Code>defaultSize</Code> is
          optional — omit it to auto-distribute remaining space.
        </TypeEntry>

        <TypeEntry
          name="SizeSpec"
          to="sizing"
          teaches="Sizing"
          signature={`type SizeSpec = number | string;
// number  -> pixels
// string  -> "240px" | "33%" | "2rem" | "0" | "calc(100% - 240px)"`}
        >
          The accepted size value for panel sizes and collapse thresholds. A
          number is pixels; a string carries a required unit, the literal{" "}
          <Code>"0"</Code>, or a <Code>calc()</Code> of dimensions joined with{" "}
          <Code>+</Code> / <Code>-</Code>. Its strict grammar is the most common
          source of setup warnings.
        </TypeEntry>

        <Related
          items={[
            {
              to: "/docs/mental-model",
              label: "Mental model",
              note: "how these types fit together",
            },
            {
              to: "/docs/panel",
              label: "Panel",
              note: "the component that consumes them",
            },
            {
              to: "/docs/panel-group",
              label: "Panel group",
              note: "the container that owns their state",
            },
          ]}
        />
      </div>
    </TypeReferenceCategoryContext.Provider>
  );
}
