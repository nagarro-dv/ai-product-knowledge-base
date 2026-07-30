import { AlertTriangle, Book, Check, CircleDashed, Copy, ExternalLink, Figma, FolderGit2, Github, KeyRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { connectFigma, disconnectFigma, recheckFigma, testFigmaConnection } from "./figmaClient";
import { disconnectJira, fetchIntegrations, startJiraConnect, type IntegrationSummary } from "./jiraClient";
import {
  connectLocalRepository,
  disconnectRepository,
  fetchGithubBranches,
  fetchGithubIdentity,
  fetchGithubOrganizations,
  fetchGithubRepositories,
  recheckRepository,
  selectGithubRepository,
  startGithubConnect,
  type GithubBranch,
  type GithubOrg,
  type GithubRepo,
} from "./repositoryClient";
import { connectStorybook, disconnectStorybook, refreshStorybook, storybookDisplayName } from "./storybookClient";
import { AssistantServiceRecovery } from "../AssistantServiceRecovery";
import { DsButton } from "../components/ds/Button";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import { SettingsSectionHeader } from "../settings/SettingsSectionHeader";
import { formatCheckedAt, formatRelativeTime } from "../settings/relativeTime";
import "./WorkspaceView.css";

type RowStatus = "connected" | "attention" | "not-connected";

function rowStatusOf(integration: IntegrationSummary): RowStatus {
  if (integration.status === "connected") return "connected";
  if (
    integration.status === "error" ||
    integration.status === "needs-auth" ||
    integration.status === "cli-missing" ||
    integration.status === "network-error"
  ) {
    return "attention";
  }
  return "not-connected";
}

function statusIcon(status: RowStatus) {
  if (status === "connected") return <Check size={13} strokeWidth={2.5} className="workspaceView__icon--ok" aria-hidden />;
  if (status === "attention") return <AlertTriangle size={13} className="workspaceView__icon--warn" aria-hidden />;
  return <CircleDashed size={13} className="workspaceView__icon--muted" aria-hidden />;
}

/** Matches the workspace's natural setup order: what to browse, where to write it, optional design source, then ticket context. */
const JOURNEY_ORDER = ["storybook", "repository", "figma", "jira"];
function orderForJourney(list: IntegrationSummary[]): IntegrationSummary[] {
  return [...list].sort((a, b) => JOURNEY_ORDER.indexOf(a.id) - JOURNEY_ORDER.indexOf(b.id));
}

/**
 * Storybook needs its own row: connecting is a URL + validate-before-store
 * round trip rather than an OAuth redirect, and connected state exposes
 * re-index / change URL actions the generic row doesn't have.
 */
function StorybookRow({ integration, onChanged }: { integration: IntegrationSummary; onChanged: () => Promise<void> }) {
  const status = rowStatusOf(integration);
  const [editing, setEditing] = useState(false);
  // Deliberately NEVER seeded from `integration.url` — that was the exact
  // bug: pre-filling this field with the current URL meant a paste (without
  // first selecting the existing text) inserted at the cursor instead of
  // replacing it, silently concatenating old+new into one invalid string.
  // Starting empty makes that impossible by construction; the current URL
  // is shown as a placeholder instead, for context without being editable.
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"connect" | "reindex" | "disconnect" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) urlInputRef.current?.focus();
  }, [editing]);

  const openEditor = () => {
    setUrl("");
    setFormError(null);
    setEditing(true);
  };

  const closeEditor = () => {
    setEditing(false);
    setFormError(null);
  };

  const handleConnect = async () => {
    if (!url.trim() || busy) return;
    setBusy("connect");
    setFormError(null);
    try {
      await connectStorybook(url);
      setEditing(false);
      await onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not connect to that Storybook.");
    } finally {
      setBusy(null);
    }
  };

  const handleReindex = async () => {
    setBusy("reindex");
    try {
      await refreshStorybook();
    } catch {
      // surfaced via the row's own error status on next load
    } finally {
      setBusy(null);
      await onChanged();
    }
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      await disconnectStorybook();
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="workspaceView__row workspaceView__row--stacked">
      <div className="workspaceView__rowMain">
        <span className={`workspaceView__avatar workspaceView__avatar--${status}`} aria-hidden>
          <Book size={16} strokeWidth={1.8} />
        </span>
        <div className="workspaceView__rowCopy">
          <DsTypography as="p" variant="paragraph-small-bold">
            {status === "connected" ? storybookDisplayName(integration) : "Storybook"}
          </DsTypography>
          <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
            {status === "connected"
              ? `${integration.componentCount ?? 0} components indexed${
                  integration.versionLabel ? ` · Storybook ${integration.versionLabel}` : ""
                }${integration.lastIndexedAt ? ` · re-indexed ${formatRelativeTime(integration.lastIndexedAt)}` : ""}`
              : status === "attention"
                ? integration.error || "Couldn't reach this Storybook."
                : "Connect a running or hosted Storybook to make its components searchable as sources."}
          </DsTypography>
          {status === "connected" && integration.url && integration.projectTitle ? (
            <a href={integration.url} target="_blank" rel="noreferrer" className="workspaceView__siteLink">
              {integration.url.replace(/^https?:\/\//, "")}
              <ExternalLink size={11} aria-hidden />
            </a>
          ) : status === "connected" && integration.url ? (
            <a href={integration.url} target="_blank" rel="noreferrer" className="workspaceView__siteLink">
              Open Storybook
              <ExternalLink size={11} aria-hidden />
            </a>
          ) : null}
        </div>
        <span className="workspaceView__rowStatusIcon">{statusIcon(status)}</span>
        <div className="workspaceView__rowAction workspaceView__rowActionGroup">
          {status === "connected" ? (
            <>
              <DsButton variant="ghost" size="mini" onClick={() => void handleReindex()} disabled={busy !== null}>
                {busy === "reindex" ? <DsSpinner size={12} aria-hidden /> : "Re-index"}
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={editing ? closeEditor : openEditor} disabled={busy !== null}>
                Change URL
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={() => void handleDisconnect()} disabled={busy !== null}>
                {busy === "disconnect" ? "…" : "Disconnect"}
              </DsButton>
            </>
          ) : (
            <DsButton variant="ghost" size="mini" onClick={editing ? closeEditor : openEditor} disabled={busy !== null}>
              {status === "attention" ? "Reconnect" : "Connect"}
            </DsButton>
          )}
        </div>
      </div>
      {editing ? (
        <div className="workspaceView__inlineConnect">
          <input
            ref={urlInputRef}
            className="workspaceView__inlineConnectInput"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              status === "connected" && integration.url
                ? `Currently: ${integration.url.replace(/^https?:\/\//, "")}`
                : "http://localhost:6006 or https://your-storybook.example.com"
            }
            aria-label="New Storybook URL"
            disabled={busy !== null}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConnect();
              if (e.key === "Escape") closeEditor();
            }}
          />
          <DsButton
            variant="primary"
            size="mini"
            onClick={() => void handleConnect()}
            disabled={busy !== null || !url.trim()}
          >
            {busy === "connect" ? "Connecting…" : "Save"}
          </DsButton>
          <DsButton variant="ghost" size="mini" onClick={closeEditor} disabled={busy !== null}>
            Cancel
          </DsButton>
          {busy === "connect" ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__inlineConnectStatus" aria-live="polite">
              Checking for a Storybook at this address…
            </DsTypography>
          ) : null}
          {formError ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__inlineConnectError" role="alert">
              {formError}
            </DsTypography>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Copy-to-clipboard button with a brief "Copied" confirmation — matches the pattern used in ConnectMethodModal for other one-time terminal commands. */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (permissions/insecure context) — the command is still selectable text.
    }
  };
  return (
    <button type="button" className="workspaceView__copyButton" onClick={() => void copy()} aria-label={copied ? "Copied" : "Copy command"}>
      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * The one-time setup steps — always visible while not connected (no
 * disclosure to click through first; there are only two or three short
 * steps and hiding them just adds a decision). Ends in the row's one real
 * action: proving sign-in actually worked, not just prompting the user to
 * notice a separate button elsewhere once they're done.
 *
 * Figma's remote MCP server only supports interactive OAuth sign-in — no
 * personal access token, no bearer-header auth, and its OAuth client is
 * allowlisted to a fixed set of MCP clients (VS Code, Cursor, Claude Code),
 * so this app cannot register its own OAuth app and complete this for the
 * user (see FigmaIntegration.ts for the full research). The one genuinely
 * required step — signing in — is handed to the user directly, in plain
 * language, with nothing technical exposed unless they ask for it.
 */
function FigmaSetupSteps({
  integration,
  onVerify,
  verifying,
}: {
  integration: IntegrationSummary;
  onVerify: () => void;
  verifying: boolean;
}) {
  const cliMissing = integration.status === "cli-missing";
  const loginCommand = integration.loginCommand ?? "claude mcp login figma";

  return (
    <div className="workspaceView__figmaGuide">
      <ol className="workspaceView__steps">
        {cliMissing ? (
          <li>
            <div className="workspaceView__stepBody">
              <DsTypography as="p" variant="paragraph-small-regular">
                Install Claude Code from{" "}
                <a href="https://claude.com/code" target="_blank" rel="noreferrer">
                  claude.com/code
                </a>
                .
              </DsTypography>
            </div>
          </li>
        ) : (
          <li>
            <div className="workspaceView__stepBody">
              <DsTypography as="p" variant="paragraph-small-regular">
                Open a terminal on this computer and run:
              </DsTypography>
              <div className="workspaceView__commandChip">
                <code>{loginCommand}</code>
                <CopyButton value={loginCommand} />
              </div>
            </div>
          </li>
        )}
        <li>
          <div className="workspaceView__stepBody">
            <DsTypography as="p" variant="paragraph-small-regular">
              Sign in with your Figma account in the browser window that opens.
            </DsTypography>
          </div>
        </li>
      </ol>
      <DsButton variant="secondary" size="small" onClick={onVerify} disabled={verifying}>
        {verifying ? <DsSpinner size={13} aria-hidden /> : "I've signed in — Verify"}
      </DsButton>
    </div>
  );
}

/**
 * Header actions mirror Storybook/Repository (right-aligned in rowMain,
 * ghost mini buttons) once connected: "Verify connection" / "Re-verify" +
 * "Disconnect". While not connected, the header carries no action at all —
 * the setup steps below are the only path forward, ending in the one real
 * verify action (see FigmaSetupSteps). "Connected" is never shown as fully
 * green until a real MCP round trip has actually succeeded once, so the
 * status can't look done before it's proven — see `hasVerification` below.
 */
function FigmaRow({ integration, onChanged }: { integration: IntegrationSummary; onChanged: () => Promise<void> }) {
  const status = rowStatusOf(integration);
  const [busy, setBusy] = useState<"verify" | "disconnect" | "test" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const registeredOnceRef = useRef(false);

  // Registration has no user input and no meaningful failure mode worth a
  // click — do it silently the moment we see a never-set-up server, so the
  // setup steps below only ever ask for the one thing that's actually left.
  useEffect(() => {
    if (integration.status === "not-connected" && !registeredOnceRef.current) {
      registeredOnceRef.current = true;
      void connectFigma().then(() => onChanged());
    }
    if (integration.status !== "not-connected") registeredOnceRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integration.status]);

  const connected = integration.status === "connected";
  const hasVerification = Boolean(integration.lastVerifiedAt || integration.account);
  // Signed in but never proven to actually work reads as "needs attention,"
  // not "connected" — closes the gap where the row went green before the
  // user ran a real verification.
  const effectiveStatus: RowStatus = connected && !hasVerification ? "attention" : status;

  const handleDisconnect = async () => {
    setBusy("disconnect");
    setActionError(null);
    try {
      await disconnectFigma();
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not disconnect Figma.");
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy("test");
    setActionError(null);
    try {
      await testFigmaConnection();
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not verify the Figma connection.");
    } finally {
      setBusy(null);
    }
  };

  // The setup steps' one action: confirm sign-in AND prove the MCP round
  // trip actually works, in a single click — replaces the old two-step
  // "Check connection" (CLI status only) followed by a separately-noticed
  // "Test connection" (the real round trip) with one action that means
  // exactly what it says.
  const handleVerifySetup = async () => {
    setBusy("verify");
    setActionError(null);
    try {
      const afterRecheck = await recheckFigma();
      if (afterRecheck.status === "connected") {
        try {
          await testFigmaConnection();
        } catch {
          // Sign-in itself still succeeded — surfaced via the test-failure note below instead.
        }
      }
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not verify the Figma connection.");
    } finally {
      setBusy(null);
    }
  };

  // Test/verify can leave `error` populated even while the connection
  // status itself is fine (still 'connected') — that's the round trip's own
  // failure reason, not a sign-in problem, so show it as its own note
  // rather than folding it into the primary summary line.
  const testNote = integration.error;
  const oneLineSummary = connected
    ? hasVerification
      ? "Connected through Claude Code MCP."
      : "Signed in — not verified yet."
    : "Connect Figma so the AI can actually inspect the selected frame — variables, Auto Layout, components, styles — instead of only reading the pasted link.";

  return (
    <div className="workspaceView__row workspaceView__row--stacked">
      <div className="workspaceView__rowMain">
        <span className={`workspaceView__avatar workspaceView__avatar--${effectiveStatus}`} aria-hidden>
          <Figma size={16} strokeWidth={1.8} />
        </span>
        <div className="workspaceView__rowCopy">
          <DsTypography as="p" variant="paragraph-small-bold">
            Figma
          </DsTypography>
          <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
            {oneLineSummary}
          </DsTypography>
        </div>
        <span className="workspaceView__rowStatusIcon">{statusIcon(effectiveStatus)}</span>
        <div className="workspaceView__rowAction workspaceView__rowActionGroup">
          {connected ? (
            <>
              <DsButton
                variant={hasVerification ? "ghost" : "secondary"}
                size="mini"
                onClick={() => void handleTest()}
                disabled={busy !== null}
              >
                {busy === "test" ? <DsSpinner size={12} aria-hidden /> : hasVerification ? "Re-verify" : "Verify connection"}
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={() => void handleDisconnect()} disabled={busy !== null}>
                {busy === "disconnect" ? "…" : "Disconnect"}
              </DsButton>
            </>
          ) : null}
        </div>
      </div>

      {connected ? (
        <>
          {hasVerification ? (
            <dl className="workspaceView__githubDetails">
              {integration.account?.email ? (
                <div>
                  <dt>Authenticated as</dt>
                  <dd>{integration.account.email}</dd>
                </div>
              ) : null}
              {integration.account?.team ? (
                <div>
                  <dt>Workspace</dt>
                  <dd>{integration.account.team}</dd>
                </div>
              ) : null}
              {integration.lastVerifiedAt ? (
                <div>
                  <dt>Last verified</dt>
                  <dd>{formatRelativeTime(integration.lastVerifiedAt)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {hasVerification && !testNote ? (
            <DsTypography
              as="p"
              variant="paragraph-mini-regular"
              className="workspaceView__figmaConnectedHint workspaceView__figmaConnectedHint--ok"
              role="status"
              aria-live="polite"
            >
              ✓ Authentication valid · ✓ MCP responding · ✓ Accelerator can access Figma. Doesn't expire automatically —
              re-verify if Figma access ever stops working.
            </DsTypography>
          ) : testNote ? (
            <DsTypography
              as="p"
              variant="paragraph-mini-regular"
              className="workspaceView__figmaConnectedHint workspaceView__figmaConnectedHint--error"
              role="status"
              aria-live="polite"
            >
              Verification failed: {testNote}
            </DsTypography>
          ) : null}
        </>
      ) : (
        <FigmaSetupSteps integration={integration} onVerify={() => void handleVerifySetup()} verifying={busy === "verify"} />
      )}

      {integration.diagnostic ? (
        <div className="workspaceView__diagnostic">
          <button type="button" className="workspaceView__linkButton" onClick={() => setShowDiagnostic((v) => !v)} aria-expanded={showDiagnostic}>
            {showDiagnostic ? "Hide" : "Show"} advanced diagnostics
          </button>
          {showDiagnostic ? <pre className="workspaceView__diagnosticPre">{integration.diagnostic}</pre> : null}
        </div>
      ) : null}

      {actionError ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__inlineConnectError" role="alert">
          {actionError}
        </DsTypography>
      ) : null}
    </div>
  );
}

/**
 * The org → repo → branch picker shown once GitHub identity is (or just
 * became) authorized. Self-contained: on mount it checks whether GitHub is
 * already connected — if not, it's just a "Connect your GitHub account"
 * button that starts the OAuth redirect; if so (including immediately after
 * that redirect completes), it goes straight to the picker.
 */
function GithubPicker({
  autoStart,
  onConnected,
  onCancel,
}: {
  autoStart: boolean;
  onConnected: () => Promise<void>;
  onCancel: () => void;
}) {
  const [identityLoading, setIdentityLoading] = useState(true);
  const [login, setLogin] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const [orgs, setOrgs] = useState<GithubOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState(""); // "" = personal account

  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");

  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setOrgsLoading(true);
    setOrgsError(null);
    try {
      const result = await fetchGithubOrganizations();
      setOrgs(result.organizations);
      setLogin(result.login);
    } catch (err) {
      setOrgsError(err instanceof Error ? err.message : "Could not list your GitHub organizations.");
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const loadRepos = useCallback(async (org: string) => {
    setReposLoading(true);
    setReposError(null);
    setSelectedRepoFullName("");
    setBranches([]);
    setSelectedBranch("");
    try {
      const result = await fetchGithubRepositories(org || undefined);
      setRepos(result);
    } catch (err) {
      setReposError(err instanceof Error ? err.message : "Could not list repositories.");
    } finally {
      setReposLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async (repo: GithubRepo) => {
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const result = await fetchGithubBranches(repo.owner, repo.name);
      setBranches(result);
      setSelectedBranch(repo.defaultBranch);
    } catch (err) {
      setBranchesError(err instanceof Error ? err.message : "Could not list branches.");
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIdentityLoading(true);
      setIdentityError(null);
      try {
        const identity = await fetchGithubIdentity();
        if (cancelled) return;
        if (!identity.configured) {
          setNotConfigured(true);
        } else if (identity.connected) {
          setLogin(identity.login);
          void loadOrgs();
          void loadRepos("");
        } else if (autoStart) {
          startGithubConnect();
        }
      } catch (err) {
        if (!cancelled) setIdentityError(err instanceof Error ? err.message : "Could not reach GitHub.");
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRepo = repos.find((r) => r.fullName === selectedRepoFullName) ?? null;

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org);
    void loadRepos(org);
  };

  const handleRepoChange = (fullName: string) => {
    setSelectedRepoFullName(fullName);
    const repo = repos.find((r) => r.fullName === fullName);
    if (repo) void loadBranches(repo);
  };

  const handleUseRepository = async () => {
    if (!selectedRepo || !selectedBranch || connecting) return;
    setConnecting(true);
    setConnectError(null);
    try {
      await selectGithubRepository({ owner: selectedRepo.owner, repo: selectedRepo.name, branch: selectedBranch });
      await onConnected();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not clone that repository.");
    } finally {
      setConnecting(false);
    }
  };

  if (identityLoading) {
    return (
      <div className="workspaceView__githubPicker" role="status">
        <DsSpinner size={14} aria-hidden />
        <DsTypography as="p" variant="paragraph-mini-regular">
          Checking your GitHub connection…
        </DsTypography>
      </div>
    );
  }

  if (identityError) {
    return (
      <div className="workspaceView__githubPicker">
        <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__inlineConnectError" role="alert">
          {identityError}
        </DsTypography>
        <div className="workspaceView__pickerActions">
          <DsButton variant="primary" size="mini" onClick={() => window.location.reload()}>
            Try again
          </DsButton>
          <DsButton variant="ghost" size="mini" onClick={onCancel}>
            Cancel
          </DsButton>
        </div>
      </div>
    );
  }

  if (notConfigured) {
    return (
      <div className="workspaceView__githubPicker">
        <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
          GitHub isn't set up on this server yet. An admin needs to set{" "}
          <code className="workspaceView__inlineCode">GITHUB_CLIENT_ID</code> and{" "}
          <code className="workspaceView__inlineCode">GITHUB_CLIENT_SECRET</code> (see .env.example), then restart the
          assistant service.
        </DsTypography>
        <div className="workspaceView__pickerActions">
          <DsButton variant="ghost" size="mini" onClick={onCancel}>
            Close
          </DsButton>
        </div>
      </div>
    );
  }

  if (!login) {
    // Not yet authorized and autoStart didn't fire (e.g. user clicked "Change repository" after a token was revoked).
    return (
      <div className="workspaceView__githubPicker">
        <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
          Connect your GitHub account to choose a repository.
        </DsTypography>
        <div className="workspaceView__pickerActions">
          <DsButton variant="primary" size="mini" leftIcon={<Github size={13} aria-hidden />} onClick={() => startGithubConnect()}>
            Connect GitHub
          </DsButton>
          <DsButton variant="ghost" size="mini" onClick={onCancel}>
            Cancel
          </DsButton>
        </div>
      </div>
    );
  }

  return (
    <div className="workspaceView__githubPicker">
      <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
        Connected to GitHub as <strong>{login}</strong>. Choose where to work.
      </DsTypography>

      <div className="workspaceView__pickerRow">
        <label className="workspaceView__pickerLabel" htmlFor="workspace-github-org">
          Organization
        </label>
        {orgsLoading ? (
          <DsSpinner size={13} aria-hidden />
        ) : orgsError ? (
          <span className="workspaceView__pickerInlineError">
            {orgsError} <button type="button" className="workspaceView__linkButton" onClick={() => void loadOrgs()}>Retry</button>
          </span>
        ) : (
          <select
            id="workspace-github-org"
            className="workspaceView__pickerSelect"
            value={selectedOrg}
            onChange={(e) => handleOrgChange(e.target.value)}
          >
            <option value="">Personal account ({login})</option>
            {orgs.map((org) => (
              <option key={org.login} value={org.login}>
                {org.login}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="workspaceView__pickerRow">
        <label className="workspaceView__pickerLabel" htmlFor="workspace-github-repo">
          Repository
        </label>
        {reposLoading ? (
          <DsSpinner size={13} aria-hidden />
        ) : reposError ? (
          <span className="workspaceView__pickerInlineError">
            {reposError}{" "}
            <button type="button" className="workspaceView__linkButton" onClick={() => void loadRepos(selectedOrg)}>
              Retry
            </button>
          </span>
        ) : repos.length === 0 ? (
          <DsTypography as="span" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
            No repositories you can push to were found here.
          </DsTypography>
        ) : (
          <select
            id="workspace-github-repo"
            className="workspaceView__pickerSelect"
            value={selectedRepoFullName}
            onChange={(e) => handleRepoChange(e.target.value)}
          >
            <option value="">Choose a repository…</option>
            {repos
              .filter((r) => r.canPush)
              .map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName} {repo.private ? "(private)" : ""}
                </option>
              ))}
          </select>
        )}
      </div>

      {selectedRepo ? (
        <div className="workspaceView__pickerRow">
          <label className="workspaceView__pickerLabel" htmlFor="workspace-github-branch">
            Default branch
          </label>
          {branchesLoading ? (
            <DsSpinner size={13} aria-hidden />
          ) : branchesError ? (
            <span className="workspaceView__pickerInlineError">
              {branchesError}{" "}
              <button type="button" className="workspaceView__linkButton" onClick={() => void loadBranches(selectedRepo)}>
                Retry
              </button>
            </span>
          ) : (
            <select
              id="workspace-github-branch"
              className="workspaceView__pickerSelect"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name}
                  {branch.name === selectedRepo.defaultBranch ? " (repository default)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      <div className="workspaceView__pickerActions">
        <DsButton
          variant="primary"
          size="mini"
          onClick={() => void handleUseRepository()}
          disabled={!selectedRepo || !selectedBranch || connecting}
        >
          {connecting ? "Cloning…" : "Use this repository"}
        </DsButton>
        <DsButton variant="ghost" size="mini" onClick={onCancel} disabled={connecting}>
          Cancel
        </DsButton>
      </div>
      {connectError ? (
        <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__inlineConnectError" role="alert">
          {connectError}
        </DsTypography>
      ) : null}
    </div>
  );
}

/**
 * The workspace's writable repository — independent from Storybook (a
 * Storybook tells the AI what components exist; it does not tell the AI
 * where the source code lives, e.g. a connected public/third-party
 * Storybook). Supports a local folder (connected immediately, no clone step)
 * or a GitHub repository (OAuth + managed clone) — `RepositoryProvider` is
 * the shared abstraction a future GitLab/Azure DevOps connection would
 * extend the same way GitHub did, without this row needing a rewrite.
 */
function RepositoryRow({
  integration,
  onChanged,
  autoOpenGithubPicker,
}: {
  integration: IntegrationSummary;
  onChanged: () => Promise<void>;
  autoOpenGithubPicker: boolean;
}) {
  const status = rowStatusOf(integration);
  const [editing, setEditing] = useState(false);
  const [repoPath, setRepoPath] = useState("");
  const [busy, setBusy] = useState<"connect" | "recheck" | "disconnect" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showGithubPicker, setShowGithubPicker] = useState(autoOpenGithubPicker);
  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) pathInputRef.current?.focus();
  }, [editing]);

  const openEditor = () => {
    setRepoPath("");
    setFormError(null);
    setEditing(true);
  };

  const closeEditor = () => {
    setEditing(false);
    setFormError(null);
  };

  const handleConnect = async () => {
    if (!repoPath.trim() || busy) return;
    setBusy("connect");
    setFormError(null);
    try {
      await connectLocalRepository(repoPath);
      setEditing(false);
      await onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not connect that repository.");
    } finally {
      setBusy(null);
    }
  };

  const handleRecheck = async () => {
    setBusy("recheck");
    try {
      await recheckRepository();
    } catch {
      // surfaced via the row's own error status on next load
    } finally {
      setBusy(null);
      await onChanged();
    }
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    try {
      await disconnectRepository();
      await onChanged();
    } finally {
      setBusy(null);
    }
  };

  const isGithub = integration.kind === "github";
  const emptyStateExplanation =
    "The AI can analyse Storybook components without a repository, but it cannot implement changes until a writable repository is connected.";

  return (
    <div className="workspaceView__row workspaceView__row--stacked">
      <div className="workspaceView__rowMain">
        <span className={`workspaceView__avatar workspaceView__avatar--${status}`} aria-hidden>
          {isGithub ? <Github size={16} strokeWidth={1.8} /> : <FolderGit2 size={16} strokeWidth={1.8} />}
        </span>
        <div className="workspaceView__rowCopy">
          <DsTypography as="p" variant="paragraph-small-bold">
            {status === "connected" ? (isGithub ? `${integration.owner}/${integration.repo}` : "Repository") : "Repository"}
          </DsTypography>
          <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
            {status === "connected"
              ? isGithub
                ? `Connected via GitHub · branch ${integration.defaultBranch}`
                : "Connected via Local Folder · the AI reads and writes real files here."
              : status === "attention"
                ? integration.error || "This repository isn't reachable anymore."
                : emptyStateExplanation}
          </DsTypography>
          {status === "connected" && !isGithub && integration.path ? (
            <span className="workspaceView__repoPath">{integration.path}</span>
          ) : null}
          {status === "connected" && isGithub && integration.htmlUrl ? (
            <a href={integration.htmlUrl} target="_blank" rel="noreferrer" className="workspaceView__siteLink">
              {integration.htmlUrl.replace(/^https?:\/\//, "")}
              <ExternalLink size={11} aria-hidden />
            </a>
          ) : null}
        </div>
        <span className="workspaceView__rowStatusIcon">{statusIcon(status)}</span>
        <div className="workspaceView__rowAction workspaceView__rowActionGroup">
          {status === "connected" && isGithub ? (
            <>
              <DsButton variant="ghost" size="mini" onClick={() => void handleRecheck()} disabled={busy !== null}>
                {busy === "recheck" ? <DsSpinner size={12} aria-hidden /> : "Refresh"}
              </DsButton>
              <DsButton
                variant="ghost"
                size="mini"
                onClick={() => setShowGithubPicker((v) => !v)}
                disabled={busy !== null}
              >
                Change repository
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={editing ? closeEditor : openEditor} disabled={busy !== null}>
                Use a local folder instead
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={() => void handleDisconnect()} disabled={busy !== null}>
                {busy === "disconnect" ? "…" : "Disconnect"}
              </DsButton>
            </>
          ) : status === "connected" ? (
            <>
              <DsButton variant="ghost" size="mini" onClick={() => void handleRecheck()} disabled={busy !== null}>
                {busy === "recheck" ? <DsSpinner size={12} aria-hidden /> : "Re-check"}
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={editing ? closeEditor : openEditor} disabled={busy !== null}>
                Change folder
              </DsButton>
              <DsButton
                variant="ghost"
                size="mini"
                leftIcon={<Github size={13} aria-hidden />}
                onClick={() => setShowGithubPicker((v) => !v)}
                disabled={busy !== null}
              >
                Switch to GitHub
              </DsButton>
              <DsButton variant="ghost" size="mini" onClick={() => void handleDisconnect()} disabled={busy !== null}>
                {busy === "disconnect" ? "…" : "Disconnect"}
              </DsButton>
            </>
          ) : status === "attention" && isGithub ? (
            <DsButton variant="ghost" size="mini" onClick={() => setShowGithubPicker((v) => !v)} disabled={busy !== null}>
              Reconnect
            </DsButton>
          ) : status === "attention" ? (
            <DsButton variant="ghost" size="mini" onClick={editing ? closeEditor : openEditor} disabled={busy !== null}>
              Reconnect
            </DsButton>
          ) : null}
        </div>
      </div>

      {status === "connected" && isGithub ? (
        <dl className="workspaceView__githubDetails">
          <div>
            <dt>Owner</dt>
            <dd>{integration.owner}</dd>
          </div>
          <div>
            <dt>Repository</dt>
            <dd>{integration.repo}</dd>
          </div>
          <div>
            <dt>Default branch</dt>
            <dd>{integration.defaultBranch}</dd>
          </div>
          <div>
            <dt>Last synced</dt>
            <dd>{integration.lastSyncedAt ? formatRelativeTime(integration.lastSyncedAt) : "not yet"}</dd>
          </div>
        </dl>
      ) : null}

      {editing ? (
        <div className="workspaceView__inlineConnect">
          <input
            ref={pathInputRef}
            className="workspaceView__inlineConnectInput"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            placeholder={
              status === "connected" && integration.path ? `Currently: ${integration.path}` : "/path/to/your/repository"
            }
            aria-label="New repository folder path"
            disabled={busy !== null}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConnect();
              if (e.key === "Escape") closeEditor();
            }}
          />
          <DsButton
            variant="primary"
            size="mini"
            onClick={() => void handleConnect()}
            disabled={busy !== null || !repoPath.trim()}
          >
            {busy === "connect" ? "Connecting…" : "Save"}
          </DsButton>
          <DsButton variant="ghost" size="mini" onClick={closeEditor} disabled={busy !== null}>
            Cancel
          </DsButton>
          {formError ? (
            <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__inlineConnectError" role="alert">
              {formError}
            </DsTypography>
          ) : null}
        </div>
      ) : null}

      {status === "not-connected" && !editing && !showGithubPicker ? (
        <div className="workspaceView__emptyStateActions">
          <DsButton variant="secondary" size="mini" leftIcon={<FolderGit2 size={13} aria-hidden />} onClick={openEditor}>
            Connect Local Folder
          </DsButton>
          <DsButton
            variant="secondary"
            size="mini"
            leftIcon={<Github size={13} aria-hidden />}
            onClick={() => setShowGithubPicker(true)}
          >
            Connect GitHub
          </DsButton>
        </div>
      ) : null}

      {showGithubPicker ? (
        <GithubPicker
          autoStart={autoOpenGithubPicker}
          onConnected={async () => {
            setShowGithubPicker(false);
            await onChanged();
          }}
          onCancel={() => setShowGithubPicker(false)}
        />
      ) : null}
    </div>
  );
}

export function WorkspaceView() {
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  // Set by the GitHub OAuth callback redirect (see repositoryClient.ts / App.tsx's
  // useGithubCallback) — consumed once, here, to auto-open the repository picker
  // right where the user left off, then stripped so a refresh doesn't reopen it.
  const [autoOpenGithubPicker] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") !== "authorized") return false;
    params.delete("github");
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    return true;
  });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      setIntegrations(await fetchIntegrations({ signal }));
      setLastCheckedAt(Date.now());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        "We couldn't reach the assistant service, so connection status is unknown.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleDisconnect = async (id: string) => {
    setDisconnecting(true);
    try {
      if (id === "jira") await disconnectJira();
      await load();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <section className="workspaceView" aria-label="Workspace">
      <SettingsSectionHeader
        description="Connect your design system, repository, and design source so the AI works with the real thing."
        lastCheckedLabel={lastCheckedAt && !loading ? formatCheckedAt(lastCheckedAt) : null}
        onRefresh={() => void load()}
        refreshing={loading}
      />

      {loading ? (
        <div className="workspaceView__loading" role="status">
          <span>Checking connection status…</span>
        </div>
      ) : error ? (
        <AssistantServiceRecovery onRecovered={() => load()} />
      ) : (
        <div className="workspaceView__list">
          {orderForJourney(integrations).map((integration) => {
            if (integration.id === "storybook") {
              return <StorybookRow key="storybook" integration={integration} onChanged={() => load()} />;
            }
            if (integration.id === "repository") {
              return (
                <RepositoryRow
                  key="repository"
                  integration={integration}
                  onChanged={() => load()}
                  autoOpenGithubPicker={autoOpenGithubPicker}
                />
              );
            }
            if (integration.id === "figma") {
              return <FigmaRow key="figma" integration={integration} onChanged={() => load()} />;
            }
            const status = rowStatusOf(integration);
            return (
              <div key={integration.id} className="workspaceView__row">
                <span className={`workspaceView__avatar workspaceView__avatar--${status}`} aria-hidden>
                  <KeyRound size={16} strokeWidth={1.8} />
                </span>
                <div className="workspaceView__rowCopy">
                  <DsTypography as="p" variant="paragraph-small-bold">
                    {integration.label}
                  </DsTypography>
                  <DsTypography as="p" variant="paragraph-mini-regular" className="workspaceView__rowDescription">
                    {integration.status === "connected" && integration.connectedAs
                      ? `Connected to ${integration.connectedAs}`
                      : integration.status === "error" && integration.error
                        ? integration.error
                        : integration.configured
                          ? "Search and attach real tickets as context."
                          : "Ask your admin to set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET to enable."}
                  </DsTypography>
                  {integration.status === "connected" && integration.siteUrl ? (
                    <a href={integration.siteUrl} target="_blank" rel="noreferrer" className="workspaceView__siteLink">
                      {integration.siteUrl.replace(/^https?:\/\//, "")}
                      <ExternalLink size={11} aria-hidden />
                    </a>
                  ) : null}
                </div>
                <span className="workspaceView__rowStatusIcon">{statusIcon(status)}</span>
                <div className="workspaceView__rowAction">
                  {!integration.configured ? null : integration.status === "connected" ? (
                    <DsButton
                      variant="ghost"
                      size="mini"
                      onClick={() => void handleDisconnect(integration.id)}
                      disabled={disconnecting}
                    >
                      {disconnecting ? "…" : "Disconnect"}
                    </DsButton>
                  ) : (
                    <DsButton variant="ghost" size="mini" onClick={() => startJiraConnect()}>
                      {integration.status === "error" ? "Reconnect" : "Connect"}
                    </DsButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
