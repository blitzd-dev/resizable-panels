import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider";

// Always client-render. Prerendered HTML is for crawlers/first paint; hydrating
// it fights React useId mismatches from the Playwright build session and
// recovers to a full client render anyway.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
