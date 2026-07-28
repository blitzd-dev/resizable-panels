import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import AccessibilityMotionTest from "./fixtures/AccessibilityMotionTest";
import AccessibilitySsrTest from "./fixtures/AccessibilitySsrTest";
import ApiCompositionTest from "./fixtures/ApiCompositionTest";
import AutoCollapseTest from "./fixtures/AutoCollapseTest";
import CascadeLatchingTest from "./fixtures/CascadeLatchingTest";
import CascadeSymmetricTest from "./fixtures/CascadeSymmetricTest";
import CoincidentHandlesTest from "./fixtures/CoincidentHandlesTest";
import CollapseBelowTest from "./fixtures/CollapseBelowTest";
import CollapsiblePeerTest from "./fixtures/CollapsiblePeerTest";
import ContainerResizeLifecycleTest from "./fixtures/ContainerResizeLifecycleTest";
import ContainerResizePolicyTest from "./fixtures/ContainerResizePolicyTest";
import ContentBoxMeasurementTest from "./fixtures/ContentBoxMeasurementTest";
import ControlledCollapsedTest from "./fixtures/ControlledCollapsedTest";
import DynamicOrderTest from "./fixtures/DynamicOrderTest";
import ExplicitHandleTest from "./fixtures/ExplicitHandleTest";
import FourColumnsTest from "./fixtures/FourColumnsTest";
import GroupStateAtomicityTest from "./fixtures/GroupStateAtomicityTest";
import GroupStateRenderLocalityTest from "./fixtures/GroupStateRenderLocalityTest";
import GroupStateTest from "./fixtures/GroupStateTest";
import GutterHandleTest from "./fixtures/GutterHandleTest";
import HandleCompositionTest from "./fixtures/HandleCompositionTest";
import HydrationLifecycleTest from "./fixtures/HydrationLifecycleTest";
import IdentityScopesTest from "./fixtures/IdentityScopesTest";
import IdentityTest from "./fixtures/IdentityTest";
import ImperativeTest from "./fixtures/ImperativeTest";
import ImplicitProviderTest from "./fixtures/ImplicitProviderTest";
import InitialPaintTest from "./fixtures/InitialPaintTest";
import LargeLayoutInstrumentationTest from "./fixtures/LargeLayoutInstrumentationTest";
import MultiPeerTest from "./fixtures/MultiPeerTest";
import NestedAnimationIntegrityTest from "./fixtures/NestedAnimationIntegrityTest";
import NestedPersistenceTest from "./fixtures/NestedPersistenceTest";
import NestedTest from "./fixtures/NestedTest";
import NeverSquishTest from "./fixtures/NeverSquishTest";
import OverconstrainedNoMoveClickTest from "./fixtures/OverconstrainedNoMoveClickTest";
import OverconstrainedRailsTest from "./fixtures/OverconstrainedRailsTest";
import PercentageBoundsMotionTest from "./fixtures/PercentageBoundsMotionTest";
import PersistenceTest from "./fixtures/PersistenceTest";
import PersistenceWriteLifecycleTest from "./fixtures/PersistenceWriteLifecycleTest";
import RenderCountTest from "./fixtures/RenderCountTest";
import ResizeSessionLifecycleTest from "./fixtures/ResizeSessionLifecycleTest";
import ResponsiveDrawerTest from "./fixtures/ResponsiveDrawerTest";
import SameTokenReorderTest from "./fixtures/SameTokenReorderTest";
import ScaledContainerTest from "./fixtures/ScaledContainerTest";
import SpecialIdsTest from "./fixtures/SpecialIdsTest";
import StateApiTest from "./fixtures/StateApiTest";
import StringDefaultCollapseTest from "./fixtures/StringDefaultCollapseTest";
import StringDefaultLiveTrackingTest from "./fixtures/StringDefaultLiveTrackingTest";
import ZeroCollapsedToggleTest from "./fixtures/ZeroCollapsedToggleTest";
import ZeroSizingTest from "./fixtures/ZeroSizingTest";
import "./styles.css";

/**
 * Entry point for the e2e harness. One full-viewport fixture per pathname —
 * the same `/test/*` URLs the specs have always targeted. A plain pathname
 * switch instead of a router: fixtures never navigate, and reload-driven
 * specs (persistence) go through the dev server's SPA fallback anyway.
 *
 * StrictMode is intentional: the library must behave under double-invoked
 * renders/effects, and RenderCountTest's counters are written to tolerate it.
 */
const ROUTES: Record<string, React.ComponentType> = {
  "/test/accessibility-motion": AccessibilityMotionTest,
  "/test/accessibility-motion-ssr": AccessibilitySsrTest,
  "/test/api-composition": ApiCompositionTest,
  "/test/auto-collapse": AutoCollapseTest,
  "/test/four-columns": FourColumnsTest,
  "/test/gutter-handle": GutterHandleTest,
  "/test/hydration-lifecycle": HydrationLifecycleTest,
  "/test/dynamic-order": DynamicOrderTest,
  "/test/explicit-handle": ExplicitHandleTest,
  "/test/handle-composition": HandleCompositionTest,
  "/test/identity": IdentityTest,
  "/test/identity-scopes": IdentityScopesTest,
  "/test/implicit-provider": ImplicitProviderTest,
  "/test/initial-paint": InitialPaintTest,
  "/test/large-layout-instrumentation": LargeLayoutInstrumentationTest,
  "/test/nested": NestedTest,
  "/test/nested-animation-integrity": NestedAnimationIntegrityTest,
  "/test/never-squish": NeverSquishTest,
  "/test/overconstrained-no-move-click": OverconstrainedNoMoveClickTest,
  "/test/overconstrained-rails": OverconstrainedRailsTest,
  "/test/percentage-bounds-motion": PercentageBoundsMotionTest,
  "/test/multi-peer": MultiPeerTest,
  "/test/cascade-latching": CascadeLatchingTest,
  "/test/cascade-symmetric": CascadeSymmetricTest,
  "/test/persistence": PersistenceTest,
  "/test/persistence-write-lifecycle": PersistenceWriteLifecycleTest,
  "/test/persistence-nested": NestedPersistenceTest,
  "/test/render-count": RenderCountTest,
  "/test/imperative": ImperativeTest,
  "/test/collapse-below": CollapseBelowTest,
  "/test/collapsible-peer": CollapsiblePeerTest,
  "/test/coincident-handles": CoincidentHandlesTest,
  "/test/container-resize-policy": ContainerResizePolicyTest,
  "/test/container-resize-lifecycle": ContainerResizeLifecycleTest,
  "/test/content-box-measurement": ContentBoxMeasurementTest,
  "/test/controlled-collapsed": ControlledCollapsedTest,
  "/test/responsive-drawer": ResponsiveDrawerTest,
  "/test/same-token-reorder": SameTokenReorderTest,
  "/test/scaled-container": ScaledContainerTest,
  "/test/resize-session-lifecycle": ResizeSessionLifecycleTest,
  "/test/state-api": StateApiTest,
  "/test/group-state": GroupStateTest,
  "/test/group-state-atomicity": GroupStateAtomicityTest,
  "/test/group-state-render-locality": GroupStateRenderLocalityTest,
  "/test/special-ids": SpecialIdsTest,
  "/test/string-default-collapse": StringDefaultCollapseTest,
  "/test/string-default-live-tracking": StringDefaultLiveTrackingTest,
  "/test/zero-collapsed-toggle": ZeroCollapsedToggleTest,
  "/test/zero-sizing": ZeroSizingTest,
};

function RouteIndex() {
  return (
    <div className="route-index">
      <p>resizable-panels e2e harness — pick a fixture:</p>
      {Object.keys(ROUTES).map((path) => (
        <a key={path} href={path}>
          {path}
        </a>
      ))}
    </div>
  );
}

const Page = ROUTES[window.location.pathname] ?? RouteIndex;

const rootElement = document.getElementById("root")!;
const page = (
  <StrictMode>
    <Page />
  </StrictMode>
);
if (window.location.pathname === "/test/accessibility-motion-ssr") {
  hydrateRoot(rootElement, page);
} else {
  createRoot(rootElement).render(page);
}
