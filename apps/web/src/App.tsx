import { useCallback, useEffect, useMemo, useState } from "react";
import { Braces, Component, DraftingCompass, Search } from "lucide-react";
import { DsAcceleratorTool } from "./accelerator/DsAcceleratorTool";
import { ComponentsView } from "./ComponentsView";
import { FoundationView } from "./FoundationView";
import { COMPONENT_REGISTRY, type ComponentId } from "./component-registry";
import { useTokenMode } from "./useTokenMode";
import "./App.css";

type Section = "foundation" | "components" | "tools";

function getInitialSection(): Section {
  if (typeof window === "undefined") return "foundation";
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section === "tools") return "tools";
  if (section === "components") return "components";
  if (section === "foundation") return "foundation";
  return "foundation";
}

function SidebarNavTooltip({ label }: { label: string }) {
  return (
    <span className="app-icon-sidebar__linkTooltip" role="tooltip">
      <span className="ds-tooltip ds-tooltip--right">
        <span className="ds-tooltip__label">{label}</span>
      </span>
    </span>
  );
}

export default function App() {
  const { mode, setTheme, setAppearance, setDensity } = useTokenMode();
  const [section, setSection] = useState<Section>(getInitialSection);
  const [componentId, setComponentId] = useState<ComponentId | null>(null);
  const [componentSearchOpen, setComponentSearchOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");

  const goFoundation = useCallback(() => setSection("foundation"), []);
  const goComponents = useCallback(() => {
    setSection("components");
  }, []);
  const goTools = useCallback(() => setSection("tools"), []);

  const componentSearchTerm = componentSearch.trim().toLowerCase();
  const filteredComponents = useMemo(
    () =>
      componentSearchTerm.length === 0
        ? COMPONENT_REGISTRY
        : COMPONENT_REGISTRY.filter(
            (entry) =>
              entry.title.toLowerCase().includes(componentSearchTerm) ||
              entry.id.toLowerCase().includes(componentSearchTerm),
          ),
    [componentSearchTerm],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("section", section);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== current) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [section]);

  const showContextSidebar = section === "components" || section === "tools";
  const appBodyClassName = ["app-body", showContextSidebar ? "app-body--with-context" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-shell">
      <div className={appBodyClassName}>
        <div className="app-nav-stack">
          <aside className="app-icon-sidebar" aria-label="Playground quick navigation">
            <div className="app-icon-sidebar__brandmark" aria-hidden>
              <div className="app-icon-sidebar__logo">DS</div>
            </div>
            <div className="app-icon-sidebar__title">Starter Kit</div>
            <nav className="app-icon-sidebar__nav" aria-label="Playground icon sections">
              <div className="app-icon-sidebar__group">
                <div className="app-icon-sidebar__linkWrap">
                  <button
                    type="button"
                    className={
                      section === "tools" ? "app-icon-sidebar__link is-active" : "app-icon-sidebar__link"
                    }
                    onClick={goTools}
                    aria-label="Tools"
                    aria-current={section === "tools" ? "true" : undefined}
                  >
                    <DraftingCompass size={20} strokeWidth={1.9} aria-hidden />
                  </button>
                  <SidebarNavTooltip label="Tools" />
                </div>
              </div>
              <div className="app-icon-sidebar__group app-icon-sidebar__group--bottom">
                <div className="app-icon-sidebar__linkWrap">
                  <button
                    type="button"
                    className={
                      section === "components" ? "app-icon-sidebar__link is-active" : "app-icon-sidebar__link"
                    }
                    onClick={goComponents}
                    aria-label="Components"
                    aria-current={section === "components" ? "true" : undefined}
                  >
                    <Component size={20} strokeWidth={1.9} aria-hidden />
                  </button>
                  <SidebarNavTooltip label="Components" />
                </div>
                <div className="app-icon-sidebar__linkWrap">
                  <button
                    type="button"
                    className={
                      section === "foundation" ? "app-icon-sidebar__link is-active" : "app-icon-sidebar__link"
                    }
                    onClick={goFoundation}
                    aria-label="Foundation"
                    aria-current={section === "foundation" ? "true" : undefined}
                  >
                    <Braces size={20} strokeWidth={1.9} aria-hidden />
                  </button>
                  <SidebarNavTooltip label="Foundation" />
                </div>
              </div>
            </nav>
          </aside>

          {showContextSidebar ? (
            <aside
              className="app-context-sidebar"
              aria-label={section === "tools" ? "Tool list" : "Component list"}
            >
              {section === "tools" ? (
                <>
                  <div className="app-context-sidebar__head">
                    <h2 className="app-context-sidebar__title">Tools</h2>
                  </div>
                  <ul className="app-context-sidebar__list" aria-label="Tool list">
                    <li>
                      <button
                        type="button"
                        className="app-context-sidebar__item is-active"
                        onClick={goTools}
                      >
                        DS Accelerator
                      </button>
                    </li>
                  </ul>
                </>
              ) : (
                <>
                  <div className="app-context-sidebar__head">
                    <h2 className="app-context-sidebar__title">Components</h2>
                    <button
                      type="button"
                      className="app-context-sidebar__search-toggle"
                      aria-expanded={componentSearchOpen}
                      aria-controls="app-components-search"
                      onClick={() => {
                        setComponentSearchOpen((open) => !open);
                        if (componentSearchOpen) setComponentSearch("");
                      }}
                      title="Search components"
                    >
                      <Search size={16} strokeWidth={2} aria-hidden />
                      <span className="app-context-sidebar__search-toggle-label">Search</span>
                    </button>
                  </div>
                  {componentSearchOpen ? (
                    <div className="app-context-sidebar__search-wrap">
                      <input
                        id="app-components-search"
                        className="playground-control playground-control--search"
                        type="search"
                        value={componentSearch}
                        onChange={(e) => setComponentSearch(e.target.value)}
                        placeholder="Search components"
                      />
                    </div>
                  ) : null}
                  <ul className="app-context-sidebar__list" aria-label="Component list">
                    {filteredComponents.length === 0 ? (
                      <li className="app-context-sidebar__empty">No components found.</li>
                    ) : (
                      filteredComponents.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            className={
                              componentId === entry.id && section === "components"
                                ? "app-context-sidebar__item is-active"
                                : "app-context-sidebar__item"
                            }
                            onClick={() => {
                              setSection("components");
                              setComponentId(entry.id);
                            }}
                          >
                            {entry.title}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </>
              )}
            </aside>
          ) : null}
        </div>

        <div className="app-main-column">
          {section === "foundation" ? (
            <FoundationView
              mode={mode}
              setTheme={setTheme}
              setAppearance={setAppearance}
              setDensity={setDensity}
            />
          ) : section === "tools" ? (
            <DsAcceleratorTool />
          ) : (
            <ComponentsView
              mode={mode}
              selectedId={componentId}
              onSelectComponent={setComponentId}
              setTheme={setTheme}
              setAppearance={setAppearance}
              setDensity={setDensity}
            />
          )}
        </div>
      </div>
    </div>
  );
}
