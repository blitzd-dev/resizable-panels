import CustomStorage from "../examples/persistence/custom-storage";
import customStorageSource from "../examples/persistence/custom-storage.tsx?raw";
import DeserializeError from "../examples/persistence/deserialize-error";
import deserializeErrorSource from "../examples/persistence/deserialize-error.tsx?raw";
import LocalPersistence from "../examples/persistence/local-persistence";
import localPersistenceSource from "../examples/persistence/local-persistence.tsx?raw";
import StatusGating from "../examples/persistence/status-gating";
import statusGatingSource from "../examples/persistence/status-gating.tsx?raw";
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

export function PersistenceDoc() {
  return (
    <div className="flex flex-col gap-4">
      <P>
        Persistence makes a layout stick between sessions. Give a group a{" "}
        <Code>persistence</Code> prop with a storage <Code>key</Code> and it
        saves each panel&rsquo;s size and collapsed state, then restores them
        the next time the group mounts. It writes to the browser&rsquo;s{" "}
        <Code>localStorage</Code> by default, and you can hand it any storage
        adapter instead — including an async one.
      </P>

      <H2 id="basic">Saving to localStorage</H2>
      <P>
        Pass <Code>persistence={"{{ key }}"}</Code> to the group. Every panel
        with a <Code>panelId</Code> round-trips its size through storage, and
        collapsible panels round-trip their collapsed bit too. A panel without a{" "}
        <Code>panelId</Code> stays resizable but is not saved — the layout is
        keyed by <Code>panelId</Code>, so an unnamed panel has nothing to store
        under.
      </P>
      <P>
        In the demo, drag the seam or toggle the sidebar, then press{" "}
        <em>Remount from storage</em>. That unmounts the group and mounts a
        fresh one, which reads your last layout back from{" "}
        <Code>localStorage</Code> instead of starting from the declarative
        defaults. A full browser reload behaves the same way.
      </P>
      <Example
        title="Persisting to localStorage"
        caption="A persistence key round-trips each panel's size and collapsed state through localStorage."
        whatToTry={[
          "Drag the seam, then remount",
          "Toggle the sidebar, then remount",
        ]}
        source={localPersistenceSource}
      >
        <LocalPersistence />
      </Example>
      <P>
        The stored document is keyed by <Code>panelId</Code>, so renaming or
        removing a panel simply drops its saved entry — child order is never
        persisted, because storage cannot reconstruct React&rsquo;s child order.
        The group also records its <Code>orientation</Code>: a saved horizontal
        layout is not applied to a group that later renders vertically, and the
        mismatch surfaces as a <Code>deserialize</Code> error rather than a
        silently wrong layout.
      </P>

      <H2 id="precedence">Restore, defaultValue, and declarative defaults</H2>
      <P>
        Persistence is one of three ways to seed an uncontrolled group, and they
        follow a strict precedence. A valid restored value wins. If nothing is
        stored yet — or the read fails — the group falls back to{" "}
        <Code>defaultValue</Code>. With no <Code>defaultValue</Code>, it uses
        the declarative sizes on each <Code>Panel</Code>.
      </P>
      <Pre lang="ts">{`restored value  →  defaultValue  →  declarative <Panel> defaults`}</Pre>
      <P>
        The read from storage can be asynchronous, so it does not resolve on the
        first render. Until it settles, the group paints{" "}
        <Code>defaultValue</Code> (or the declarative defaults) and then swaps
        the stored layout in without animation once it lands. That first-paint
        window is what the <DocLink to="#status">status lifecycle</DocLink>{" "}
        below lets you gate, so a reader never sees a flash of the wrong layout.
      </P>
      <P>
        A restored value seeds the group but never becomes the reset baseline:{" "}
        <Code>resetValue()</Code> returns to <Code>defaultValue</Code> (then the
        declarative defaults), not to whatever was last stored.
      </P>
      <Callout title="Persistence or controlled value, not both">
        Persistence is mutually exclusive with a controlled <Code>value</Code>.
        A controlled parent already owns storage and restoration, so passing
        both <Code>value</Code> and <Code>persistence</Code> warns and disables
        the built-in persistence. To store the layout yourself, own it with{" "}
        <DocLink to="/docs/controlled-state">
          <Code>value</Code> / <Code>onValueChange</Code>
        </DocLink>{" "}
        instead.
      </Callout>

      <H2 id="custom-storage">Custom storage</H2>
      <P>
        The <Code>storage</Code> option accepts any object with a{" "}
        <Code>getItem</Code> and a <Code>setItem</Code> method — the{" "}
        <Code>PanelStorage</Code> shape, structurally the same as Web Storage.{" "}
        <Code>localStorage</Code> and <Code>sessionStorage</Code> drop in
        directly, and both methods may return a promise, so a cookie jar, a
        server round-trip, or any async store fits the same interface.
      </P>
      <Pre lang="ts">{`type PanelStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
};`}</Pre>
      <P>
        The adapter below is an in-memory store with an artificial delay to show
        the async path. Replace the two method bodies with{" "}
        <Code>document.cookie</Code> or a <Code>fetch</Code> and nothing else
        about the group changes.
      </P>
      <Example
        title="An async PanelStorage adapter"
        caption="Any getItem/setItem pair plugs in as storage — the methods may return promises."
        whatToTry={[
          "Drag the seam, then remount",
          "Watch the 250ms restore land",
        ]}
        source={customStorageSource}
      >
        <CustomStorage />
      </Example>

      <H2 id="options">Persistence options</H2>
      <P>
        The full <Code>persistence</Code> object is a{" "}
        <DocLink to="/docs/persistence-types">
          <Code>PanelGroupPersistenceOptions</Code>
        </DocLink>
        :
      </P>
      <Table
        rows={[
          [
            "key",
            <Code>string</Code>,
            "Required. The storage key the layout is saved under and restored from. An empty key warns and is ignored.",
          ],
          [
            "storage",
            <Code>PanelStorage</Code>,
            <>
              Defaults to <Code>localStorage</Code>. Supply your own to persist
              elsewhere. SSR-safe: no storage is touched during server render.
            </>,
          ],
          [
            "onStatusChange",
            <Code>(status: PanelPersistenceStatus) =&gt; void</Code>,
            <>
              Reports the restore lifecycle. Use it to gate first paint until
              the stored layout has loaded.
            </>,
          ],
          [
            "onError",
            <Code>(error: PanelPersistenceError) =&gt; void</Code>,
            <>
              Reports read, deserialize, and write failures. Use it to log or
              surface a corrupt or unreachable store.
            </>,
          ],
        ]}
      />
      <P>
        The options object is usually a fresh literal on every render, which is
        fine: only <Code>key</Code> and <Code>storage</Code> drive the
        machinery, and the callbacks are read through a ref, so a new object
        identity each render restarts nothing.
      </P>

      <H2 id="status">Gating the first paint</H2>
      <P>
        Because restore is asynchronous, the group paints its default layout
        first and swaps in the stored one after. To hide that flash, watch the
        status. <Code>onStatusChange</Code> reports a{" "}
        <Code>PanelPersistenceStatus</Code> —{" "}
        <Code>{'{ state: "restoring", key }'}</Code> when the mount-time read
        begins, then <Code>{'{ state: "ready", key }'}</Code> exactly once,
        after the read succeeds, finds nothing, or fails. Cover the group until{" "}
        <Code>ready</Code> and the reader never sees the wrong layout.
      </P>
      <P>
        Keep the group mounted while you gate. The read runs on mount, so hiding
        the group entirely would mean <Code>ready</Code> never arrives — the
        example overlays a &ldquo;Restoring&rdquo; cover on top of an
        already-mounted group instead.
      </P>
      <Example
        title="Gating the first paint"
        caption="onStatusChange covers the group until the stored layout has loaded, so the reader never sees the default flash."
        whatToTry={[
          "Remount — watch the cover clear",
          "Drag the seam, then remount",
        ]}
        source={statusGatingSource}
      >
        <StatusGating />
      </Example>

      <H2 id="errors">Errors and the write-gate guarantee</H2>
      <P>
        A <Code>PanelPersistenceError</Code> names which operation failed. The
        full type lives on the{" "}
        <DocLink to="/docs/persistence-types">persistence types</DocLink> page;
        the three operations are:
      </P>
      <Table
        headers={["operation", "When", "Recovery"]}
        rows={[
          [
            '"read"',
            <>
              Acquiring the store or calling <Code>getItem</Code> threw or
              rejected.
            </>,
            "Reported once per restore attempt; declarative fallback kept.",
          ],
          [
            '"deserialize"',
            <>
              The stored value was invalid JSON, or an incompatible or
              orientation-mismatched layout document.
            </>,
            "Reported once per restore attempt; declarative fallback kept.",
          ],
          [
            '"write"',
            <>
              <Code>setItem</Code> threw or rejected.
            </>,
            "Recoverable — a later accepted change retries the write.",
          ],
        ]}
      />
      <P>
        A failed <Code>read</Code> or <Code>deserialize</Code> is safe by
        design: the group keeps the declarative fallback and does <em>not</em>{" "}
        overwrite the stored value. Storage is only rewritten once you make an
        explicit change the group accepts — a drag, a keyboard resize, a{" "}
        <Code>resetValue()</Code>, or an imperative action. A corrupt or older
        document therefore survives until the user deliberately moves something,
        so a transient parse failure never silently erases a good layout.
      </P>
      <Example
        title="Deserialize error and fallback"
        caption="A seeded corrupt value fires onError with operation deserialize; the group keeps its declarative defaults until you write over it."
        whatToTry={[
          "Read the deserialize error first",
          "Drag the seam, remount — restores clean",
        ]}
        source={deserializeErrorSource}
      >
        <DeserializeError />
      </Example>
      <P>
        Only explicit changes write. A system-driven change — a{" "}
        <DocLink to="/docs/collapsing">width-driven auto-collapse</DocLink>, say
        — is never persisted, so reloading at a wider size still restores the
        panel open.
      </P>

      <H2 id="gotchas">Gotchas</H2>
      <P>
        A change made before the async read finishes wins over the stored
        snapshot: if the user drags a handle during that first beat, their
        action is kept and the pending restore does not clobber it. An empty{" "}
        <Code>key</Code> warns and disables persistence. And a panel with no{" "}
        <Code>panelId</Code> is never stored — give every panel you want
        remembered a stable <Code>panelId</Code>.
      </P>

      <Related
        items={[
          {
            to: "/docs/controlled-state",
            label: "Controlled state & events",
            note: "own storage yourself with value / onValueChange",
          },
          {
            to: "/docs/persistence-types",
            label: "Persistence types",
            note: "PanelStorage, status, and error type declarations",
          },
          {
            to: "/docs/panel-group",
            label: "PanelGroup",
            note: "the defaultValue restore falls back to",
          },
          {
            to: "/docs/collapsing",
            label: "Collapsing",
            note: "the collapsed state persistence round-trips",
          },
        ]}
      />
    </div>
  );
}
