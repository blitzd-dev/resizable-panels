import { createRequire } from "node:module";
import AccessibilitySsrTest from "./fixtures/AccessibilitySsrTest";

const require = createRequire(import.meta.url);
const { renderToString } = require(
  process.env.RESIZABLE_PANELS_REACT_VERSION === "18"
    ? "react-dom18/server"
    : "react-dom/server",
) as typeof import("react-dom/server");

export function renderAccessibilitySsr(collapsed: boolean): string {
  const originalError = console.error;
  if (process.env.RESIZABLE_PANELS_REACT_VERSION === "18") {
    console.error = (...args: unknown[]) => {
      if (String(args[0]).startsWith("Warning: useLayoutEffect does nothing")) {
        return;
      }
      originalError(...args);
    };
  }
  try {
    return renderToString(
      <AccessibilitySsrTest initialCollapsed={collapsed} />,
    );
  } finally {
    console.error = originalError;
  }
}
