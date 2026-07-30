import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Settings as SettingsIcon } from "lucide-react";
import { DsAcceleratorTool } from "./accelerator/DsAcceleratorTool";
import { SettingsView, type SettingsTab } from "./settings/SettingsView";
import { JIRA_RETURN_TO_KEY } from "./integrations/jiraClient";
import { GITHUB_RETURN_TO_KEY } from "./integrations/repositoryClient";
import { OPEN_SETTINGS_EVENT } from "./navigationEvents";
import { useTokenMode } from "./useTokenMode";
import "./App.css";

/**
 * The product is an empty shell around two surfaces: the Accelerator (the
 * workflow) and Settings (connections). The design system itself lives in the
 * team's connected Storybook — there is no built-in component browser.
 */
type Section = "tools" | "settings";

function getInitialSection(): Section {
  if (typeof window === "undefined") return "tools";
  const params = new URLSearchParams(window.location.search);
  // Legacy deep links to the removed browsing sections land on the workflow.
  return params.get("section") === "settings" ? "settings" : "tools";
}

function getInitialSettingsTab(): SettingsTab {
  if (typeof window === "undefined") return "ai-models";
  const params = new URLSearchParams(window.location.search);
  return params.get("tool") === "workspace" ? "workspace" : "ai-models";
}

/** Reads a stashed pre-OAuth location (set by startJiraConnect) so the user returns
 *  to wherever they started connecting, not a hardcoded destination. Falls back to
 *  whatever the backend put in the URL when no stash exists (e.g. cross-tab). */
function useJiraCallback(): {
  banner: { kind: "connected" | "error"; message?: string } | null;
  initialOverride: { section: Section; settingsTab: SettingsTab } | null;
} {
  const [state] = useState(() => {
    if (typeof window === "undefined") return { banner: null, initialOverride: null };
    const params = new URLSearchParams(window.location.search);
    const jira = params.get("jira");
    if (jira !== "connected" && jira !== "error") return { banner: null, initialOverride: null };

    const banner = { kind: jira as "connected" | "error", message: params.get("jiraMessage") ?? undefined };
    let initialOverride: { section: Section; settingsTab: SettingsTab } | null = null;
    try {
      const stashed = sessionStorage.getItem(JIRA_RETURN_TO_KEY);
      if (stashed) {
        const stashedUrl = new URL(stashed, window.location.origin);
        const stashedParams = stashedUrl.searchParams;
        const stashedSection = stashedParams.get("section");
        if (stashedSection === "tools" || stashedSection === "settings") {
          initialOverride = {
            section: stashedSection,
            settingsTab: stashedParams.get("tool") === "workspace" ? "workspace" : "ai-models",
          };
        }
        sessionStorage.removeItem(JIRA_RETURN_TO_KEY);
      }
    } catch {
      // sessionStorage unavailable — fall back to the backend's own redirect target.
    }

    // Clean the one-shot params out of the URL so a refresh doesn't re-show the banner.
    params.delete("jira");
    params.delete("jiraMessage");
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(window.history.state, "", nextUrl);

    return { banner, initialOverride };
  });
  return state;
}

/**
 * GitHub's OAuth callback lands the user back here having only authorized the
 * *identity* — no repository is chosen yet, so unlike Jira there's nothing to
 * confirm with a banner on success (the org/repo/branch picker in
 * WorkspaceView reads `?github=authorized` itself and opens to continue the
 * flow). A failure is still worth a top-level banner in case the restored
 * section/tab isn't Settings → Workspace.
 */
function useGithubCallback(): {
  banner: { kind: "error"; message?: string } | null;
  initialOverride: { section: Section; settingsTab: SettingsTab } | null;
} {
  const [state] = useState(() => {
    if (typeof window === "undefined") return { banner: null, initialOverride: null };
    const params = new URLSearchParams(window.location.search);
    const github = params.get("github");
    if (github !== "authorized" && github !== "error") return { banner: null, initialOverride: null };

    let initialOverride: { section: Section; settingsTab: SettingsTab } | null = null;
    try {
      const stashed = sessionStorage.getItem(GITHUB_RETURN_TO_KEY);
      if (stashed) {
        const stashedUrl = new URL(stashed, window.location.origin);
        const stashedParams = stashedUrl.searchParams;
        const stashedSection = stashedParams.get("section");
        if (stashedSection === "tools" || stashedSection === "settings") {
          initialOverride = {
            section: stashedSection,
            settingsTab: stashedParams.get("tool") === "workspace" ? "workspace" : "ai-models",
          };
        }
        sessionStorage.removeItem(GITHUB_RETURN_TO_KEY);
      }
    } catch {
      // sessionStorage unavailable
    }

    if (github === "error") {
      const banner = { kind: "error" as const, message: params.get("githubMessage") ?? undefined };
      params.delete("github");
      params.delete("githubMessage");
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(window.history.state, "", nextUrl);
      return { banner, initialOverride };
    }

    // Success: leave `?github=authorized` in place — WorkspaceView reads and clears it itself.
    return { banner: null, initialOverride };
  });
  return state;
}

export default function App() {
  // Applies the persisted theme/appearance/density to the document.
  useTokenMode();
  const jiraCallback = useJiraCallback();
  const githubCallback = useGithubCallback();
  const [section, setSection] = useState<Section>(
    () => jiraCallback.initialOverride?.section ?? githubCallback.initialOverride?.section ?? getInitialSection(),
  );
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(
    () =>
      jiraCallback.initialOverride?.settingsTab ??
      githubCallback.initialOverride?.settingsTab ??
      getInitialSettingsTab(),
  );
  const [jiraBanner, setJiraBanner] = useState(jiraCallback.banner);
  const [githubBanner, setGithubBanner] = useState(githubCallback.banner);

  const goTools = useCallback(() => setSection("tools"), []);
  const goSettings = useCallback(() => setSection("settings"), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("section", section);
    if (section === "settings" && settingsTab === "workspace") {
      params.set("tool", "workspace");
    } else {
      params.delete("tool");
    }
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== current) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [section, settingsTab]);

  useEffect(() => {
    const onOpenSettings = (event: Event) => {
      const tab = (event as CustomEvent<SettingsTab | undefined>).detail;
      setSection("settings");
      if (tab) setSettingsTab(tab);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-topbar" aria-label="Top navigation">
        <button
          type="button"
          className="app-topbar__brand"
          onClick={goTools}
          aria-current={section === "tools" ? "page" : undefined}
        >
          <span className="app-topbar__logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
              <path
                d="M9 6.5 4 12l5 5.5M15 6.5 20 12l-5 5.5"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="app-topbar__title">DS Accelerator</span>
        </button>
        <button
          type="button"
          className={section === "settings" ? "app-topbar__settings is-active" : "app-topbar__settings"}
          onClick={goSettings}
          aria-current={section === "settings" ? "page" : undefined}
        >
          <SettingsIcon size={16} strokeWidth={1.9} aria-hidden />
          Settings
        </button>
      </header>

      <div className="app-body">
        <div className="app-main-column">
          {jiraBanner ? (
            <div
              className={`app-jiraBanner app-jiraBanner--${jiraBanner.kind === "connected" ? "success" : "error"}`}
              role={jiraBanner.kind === "error" ? "alert" : "status"}
            >
              {jiraBanner.kind === "connected" ? (
                <Check size={14} aria-hidden />
              ) : (
                <AlertTriangle size={14} aria-hidden />
              )}
              <span>{jiraBanner.kind === "connected" ? "Jira connected." : (jiraBanner.message ?? "Couldn't connect Jira.")}</span>
              <button type="button" className="app-jiraBanner__dismiss" onClick={() => setJiraBanner(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          ) : null}

          {githubBanner ? (
            <div className="app-jiraBanner app-jiraBanner--error" role="alert">
              <AlertTriangle size={14} aria-hidden />
              <span>{githubBanner.message ?? "Couldn't connect GitHub."}</span>
              <button
                type="button"
                className="app-jiraBanner__dismiss"
                onClick={() => setGithubBanner(null)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ) : null}

          {section === "settings" ? (
            <SettingsView activeTab={settingsTab} onTabChange={setSettingsTab} />
          ) : (
            <DsAcceleratorTool />
          )}
        </div>
      </div>
    </div>
  );
}
