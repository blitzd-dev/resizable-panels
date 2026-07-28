"use client";

import { useRef } from "react";
import { buildResolveContext, resolveSizeField } from "../core/size.js";
import {
  IS_DEVELOPMENT,
  NO_WARNINGS,
  useDevWarnings,
} from "../shared/diagnostics.js";
import { useViewportTick } from "../shared/viewport.js";
import type { PanelKind, SizeSpec } from "../types.js";

/** Kind defaults double as the fallback for an invalid `minSize` (§13):
 * they are what the panel would have used had the prop been omitted. */
const KIND_DEFAULT_MIN_PX: Record<PanelKind, number> = {
  docked: 200,
  peer: 0,
};

/** Diagnostic owner label for size warnings, e.g. `<Panel panelId="x">`. */
export function panelSizeLabel(panelId: string | undefined): string {
  return panelId ? `<Panel panelId="${panelId}">` : "<Panel>";
}

/**
 * Resolve a panel's bounds (min/max/default) into px against the current
 * container size and content element. Re-runs every render so font-size
 * changes on the content element are picked up. Subscribes to the shared
 * viewport tick so vw/vh-relative units re-resolve on window resize
 * without each panel installing its own listener.
 *
 * Invalid specs fall back per field (§13): `minSize` to the kind default,
 * `maxSize` to `100%`, a peer `defaultSize` to absent (the panel becomes
 * automatic), and a docked `defaultSize` — which is required — to the
 * resolved minimum, reported as a development error.
 *
 * The returned `contentRef` should be attached to the user-styled
 * element so `em` resolves against the consumer's typography. The returned
 * `ctx` lets callers resolve one-off specs (e.g. `collapseBelow`) against
 * the same context instead of building their own.
 */
export function useResolvedBounds({
  minSize,
  maxSize,
  defaultSize,
  containerSize,
  panelId,
  kind,
}: {
  minSize: SizeSpec;
  maxSize: SizeSpec;
  defaultSize: SizeSpec | undefined;
  containerSize: number;
  panelId?: string;
  kind: PanelKind;
}) {
  // Subscribing to the viewport tick is enough — the store re-renders this
  // hook's owning panel, which is exactly when vw/vh need to re-resolve.
  void useViewportTick();

  const contentRef = useRef<HTMLDivElement>(null);
  const ctx = buildResolveContext(contentRef.current, containerSize);
  const label = panelSizeLabel(panelId);
  const resolvedMin = resolveSizeField(minSize, ctx, {
    label,
    property: "minSize",
    fallback: KIND_DEFAULT_MIN_PX[kind],
  });
  const resolvedMax = resolveSizeField(maxSize, ctx, {
    label,
    property: "maxSize",
    fallback: ctx.containerSize,
  });
  const resolvedDefault =
    defaultSize === undefined
      ? undefined
      : resolveSizeField(defaultSize, ctx, {
          label,
          property: "defaultSize",
          // A docked panel requires defaultSize, so losing it is an error
          // and the safe minimum stands in; a peer default degrades to
          // absent and the panel becomes automatic.
          fallback: kind === "docked" ? Math.max(0, resolvedMin) : undefined,
          severity: kind === "docked" ? "error" : "warn",
        });

  const canValidate = containerSize > 0;
  // Container-relative specs legitimately cross px bounds when the container
  // shrinks — min-wins and the clamps handle it, so only static
  // misconfigurations should warn (§3.4, never-squish).
  const maxIsRelative = typeof maxSize === "string" && maxSize.includes("%");
  const defaultIsRelative =
    typeof defaultSize === "string" && defaultSize.includes("%");
  useDevWarnings(
    IS_DEVELOPMENT
      ? [
          canValidate && (!Number.isFinite(resolvedMin) || resolvedMin < 0)
            ? `${label} minSize must resolve to a finite, non-negative pixel value.`
            : null,
          canValidate && (!Number.isFinite(resolvedMax) || resolvedMax < 0)
            ? `${label} maxSize must resolve to a finite, non-negative pixel value.`
            : null,
          canValidate &&
          !maxIsRelative &&
          Number.isFinite(resolvedMin) &&
          Number.isFinite(resolvedMax) &&
          resolvedMin > resolvedMax
            ? `${label} minSize (${resolvedMin}px) cannot exceed maxSize (${resolvedMax}px).`
            : null,
          canValidate &&
          resolvedDefault !== undefined &&
          (!Number.isFinite(resolvedDefault) ||
            ((resolvedDefault < resolvedMin || resolvedDefault > resolvedMax) &&
              !defaultIsRelative))
            ? `${label} defaultSize (${resolvedDefault}px) must resolve within minSize (${resolvedMin}px) and maxSize (${resolvedMax}px).`
            : null,
        ]
      : NO_WARNINGS,
  );

  // Keep invalid consumer values from poisoning resize arithmetic. Diagnostics
  // retain the original resolved values above; runtime math receives a safe,
  // ordered interval.
  const minPx = Number.isFinite(resolvedMin) ? Math.max(0, resolvedMin) : 0;
  const maxPx = Number.isFinite(resolvedMax)
    ? Math.max(minPx, resolvedMax)
    : minPx;
  const defaultPx =
    resolvedDefault === undefined || !Number.isFinite(resolvedDefault)
      ? undefined
      : resolvedDefault;

  return { contentRef, minPx, maxPx, defaultPx, ctx };
}
