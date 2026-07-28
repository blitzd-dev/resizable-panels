import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";

export default function ExplicitHandleTest() {
  const query = new URLSearchParams(window.location.search);
  const disabled = query.has("disabled");
  const rtl = query.has("rtl");
  const nested = query.has("nested");
  const constrained = query.has("constrained");
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" dir={rtl ? "rtl" : "ltr"}>
          <Panel
            panelId="left"
            side="start"
            defaultSize={300}
            minSize={100}
            maxSize={500}
            disabled={disabled}
          >
            left
          </Panel>
          <PanelResizeHandle data-testid="explicit-handle" />
          <Panel
            panelId="main"
            defaultSize={constrained ? 400 : undefined}
            minSize={constrained ? 350 : 100}
            maxSize={constrained ? 450 : undefined}
          >
            {nested ? (
              <PanelGroup orientation="horizontal" dir="ltr">
                <Panel panelId="inner-first" defaultSize={200} minSize={100}>
                  inner first
                </Panel>
                <PanelResizeHandle data-testid="inner-handle" />
                <Panel panelId="inner-second" minSize={100}>
                  inner second
                </Panel>
              </PanelGroup>
            ) : (
              "main"
            )}
          </Panel>
          {constrained ? (
            <Panel panelId="tail" defaultSize={500} minSize={480} maxSize={520}>
              tail
            </Panel>
          ) : null}
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
