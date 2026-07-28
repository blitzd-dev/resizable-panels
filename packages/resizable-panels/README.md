# @blitzd/resizable-panels

Headless, animated, resizable panel layouts for React.

- **Headless** — no stylesheet to import, no design opinions. You style the DOM.
- **No setup** — a single `<PanelGroup>` works on its own; no provider to wire up.
- **Complete** — docked & peer panels, nested groups, collapse (animated or to a
  rail), drag-to-collapse thresholds, persistence, RTL, SSR, and a full keyboard
  and screen-reader story.

## Install

```sh
npm install @blitzd/resizable-panels
```

React 18.2+ and 19. ESM only. Modern Chrome, Firefox, Safari, and Edge.

## Quick start

Three pieces: a `PanelGroup` sets the axis, `Panel`s sit inside it, and a
`PanelResizeHandle` goes between two panels as their direct sibling. The group
fills its container, so give the container a size.

```tsx
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";

export function Split() {
  return (
    <div style={{ height: 300 }}>
      <PanelGroup orientation="horizontal">
        <Panel>Left</Panel>
        <PanelResizeHandle />
        <Panel>Right</Panel>
      </PanelGroup>
    </div>
  );
}
```

Drag the seam — the two panels share the space. That is the whole model.

## A collapsible sidebar

Give a panel a `side` and it becomes a *docked* panel: it has its own size and
collapses (by default, animated). Everything else stays a *peer* that shares the
remaining space.

```tsx
<div style={{ height: 400 }}>
  <PanelGroup orientation="horizontal">
    <Panel side="start" defaultSize={240} minSize={160} collapsible>
      Sidebar
    </Panel>
    <PanelResizeHandle />
    <Panel>Editor</Panel>
  </PanelGroup>
</div>
```

Sizes accept pixels or a CSS-ish string — `defaultSize="30%"`,
`minSize="16rem"`, `maxSize="calc(100% - 320px)"`.

## Control it from your app

Give a panel a `panelId` and its group a `groupId`, and read or drive it from
anywhere — no prop drilling:

```tsx
import { usePanelControls } from "@blitzd/resizable-panels";

function SidebarToggle() {
  const sidebar = usePanelControls({ groupId: "workspace", panelId: "sidebar" });
  return <button onClick={() => sidebar?.toggle()}>Toggle sidebar</button>;
}
```

Prefer to own the state yourself? Every collapsible panel takes a controlled
`collapsed` prop, and every group takes a controlled `value` — both propose
changes through callbacks you accept or decline.

## Documentation

Full guides, live examples, and the API reference:
[resizable-panels.blitzd.dev](https://resizable-panels.blitzd.dev)

## License

[MIT](LICENSE)
