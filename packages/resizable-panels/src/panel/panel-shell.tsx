"use client";

import type {
  CSSProperties,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { isValidSizeSpec } from "../core/size.js";
import type { SizeSpec } from "../types.js";
import type { PanelFoundation } from "./use-panel-foundation.js";

type SlotRestProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "className" | "style"
>;

/** The DOM chrome both kinds render: root (spread order — consumer element
 * props first, then the library's structural attributes), viewport clip
 * box, and the content element the consumer's children land in. Only the
 * kind-specific pieces vary: `data-kind`, the docked-only `data-side`, and
 * the outer/content style objects computed by each kind's own layout
 * model. A plain function (not a component) so the rendered element tree
 * is identical to the previous inline JSX. */
export function renderPanelShell(
  f: PanelFoundation,
  elementProps: SlotRestProps,
  className: string | undefined,
  style: CSSProperties | undefined,
  outerStyle: CSSProperties,
  contentStyle: CSSProperties,
  children: ReactNode,
): ReactElement {
  return (
    <div
      {...elementProps}
      id={f.domId}
      ref={f.setRootRef}
      data-resizable-panels-panel=""
      data-resizable-panels-panel-id={f.panelId}
      data-kind={f.kind}
      data-side={f.side}
      data-axis={f.group.orientation}
      // `data-state` is cause-agnostic (R-37): it reports the EFFECTIVE
      // collapsed state whether the fold is user-, controlled-, or width-driven.
      data-state={f.presentationCollapsed ? "collapsed" : "expanded"}
      // Additive cause-specific hook for width-driven folds only (R-37).
      data-auto-collapsed={f.autoCollapsed ? "" : undefined}
      aria-hidden={f.collapsedIsHidden ? true : elementProps["aria-hidden"]}
      inert={f.inert}
      className={className}
      style={{ ...style, ...outerStyle }}
    >
      <div
        {...f.viewportProps}
        data-resizable-panels-panel-viewport=""
        className={f.viewportClassName}
        style={{
          ...f.viewportStyle,
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        <div
          {...f.contentProps}
          ref={f.contentRef}
          data-resizable-panels-panel-content=""
          className={f.contentClassName}
          style={contentStyle}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** SizeSpec → CSS length for SSR/bootstrap styles, where specs are emitted
 * before measurement can resolve them. Every accepted spec is valid CSS with
 * identical meaning; an invalid spec must never reach the stylesheet raw, so
 * it degrades to the caller's field-appropriate fallback. The matching
 * development warning comes from the pixel resolution path, which sees the
 * same spec. */
export function toCssSize(size: SizeSpec, fallback: string): string {
  if (typeof size === "number") {
    return Number.isFinite(size) ? `${size}px` : fallback;
  }
  return isValidSizeSpec(size) ? size : fallback;
}
