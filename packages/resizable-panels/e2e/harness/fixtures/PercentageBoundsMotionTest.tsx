import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody, Toolbar } from "./shared";

export default function PercentageBoundsMotionTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          groupId="percentage-motion"
          data-testid="percentage-motion-group"
        >
          <Panel
            panelId="percentage-left"
            side="start"
            defaultSize="33%"
            minSize="10%"
            maxSize="50%"
          >
            <PanelBody groupId="percentage-motion" label="percentage-left" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="percentage-middle">
            <PanelBody
              groupId="percentage-motion"
              label="percentage-middle"
              variant="grow"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="percentage-right"
            side="end"
            defaultSize="33%"
            minSize="10%"
            maxSize="50%"
          >
            <PanelBody groupId="percentage-motion" label="percentage-right" />
          </Panel>
        </PanelGroup>
        <Toolbar
          panels={["percentage-left", "percentage-right"].map((panelId) => ({
            groupId: "percentage-motion",
            panelId,
          }))}
        />
      </div>
    </PanelProvider>
  );
}
