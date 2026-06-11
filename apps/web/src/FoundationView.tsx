import { lazy, Suspense } from "react";
import type { Mode } from "@ds-starter/tokens";
import { ModeControls } from "./ModeControls";
import "./DsView.css";

const VariableViewer = lazy(() =>
  import("./VariableViewer").then((m) => ({ default: m.VariableViewer })),
);

type Props = {
  mode: Mode;
  setTheme: (t: Mode["theme"]) => void;
  setAppearance: (a: Mode["appearance"]) => void;
  setDensity: (d: Mode["density"]) => void;
};

export function FoundationView({ mode, setTheme, setAppearance, setDensity }: Props) {
  return (
    <div className="ds-view">
      <header className="app-header">
        <div className="app-header__titles">
          <h1>Foundation</h1>
          <p className="app-header__lead">
            Inspect resolved design tokens across theme, appearance, and density. Source JSON lives in{" "}
            <code>packages/tokens</code>; CSS is generated via <code>npm run tokens:build</code>.
          </p>
        </div>
        <ModeControls
          mode={mode}
          setTheme={setTheme}
          setAppearance={setAppearance}
          setDensity={setDensity}
        />
      </header>

      <main className="ds-view__main">
        <Suspense fallback={<p className="ds-view__lazy-fallback">Loading token inspector…</p>}>
          <VariableViewer mode={mode} />
        </Suspense>
      </main>
    </div>
  );
}
