import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { PasswordGate } from "./gate/PasswordGate";
import "./index.css";

// The brand stand-in (Plus Jakarta Sans — see index.css) is registered via
// @font-face but browsers only fetch a face once something on screen is
// confirmed to need it, which can lose a beat on first paint and show a
// system-font flash. Explicitly requesting the weights actually used above
// the fold starts the fetch immediately instead of waiting on that
// heuristic.
if (typeof document !== "undefined" && "fonts" in document) {
  for (const desc of ["400 16px", "500 16px", "600 16px", "700 16px", "800 16px"]) {
    document.fonts.load(`${desc} "Plus Jakarta Sans"`).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* On the hosted site, the app sits behind one shared password. */}
    <PasswordGate>
      <App />
    </PasswordGate>
  </StrictMode>,
);
