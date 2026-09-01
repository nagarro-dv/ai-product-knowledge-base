import { Component, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import "../index.css";
import {
  PREVIEW_FRAME_ERROR,
  PREVIEW_FRAME_QA_RESULT,
  PREVIEW_FRAME_READY,
  type PreviewFrameQaFinding,
} from "./previewFrameProtocol";

// Dev-mode HMR can re-run this entry module against the same #preview-root
// element (Vite/React Refresh don't always treat a bare side-effect module
// like this one as its own boundary). Calling createRoot() twice on one
// container is a hard React warning and orphans the first root, so cache it
// and reuse .render() instead of ever creating a second one.
let cachedRoot: Root | null = null;
function getRoot(container: Element): Root {
  if (!cachedRoot) cachedRoot = createRoot(container);
  return cachedRoot;
}

function reportReady() {
  window.parent.postMessage({ kind: PREVIEW_FRAME_READY }, "*");
}

function reportError(message: string) {
  window.parent.postMessage({ kind: PREVIEW_FRAME_ERROR, message }, "*");
}

/**
 * Generated CSS occasionally sizes a wrapper purely off a percentage
 * (`width: min(100%, 200px)` etc.) while every one of its children is
 * `position: absolute` — leaving nothing in normal flow to establish the
 * wrapper's own size. Deep inside nested flex/grid columns the percentage
 * basis can end up indefinite, so the box silently collapses to 0 and every
 * absolutely-positioned layer inside it (and every sibling instance doing
 * the same thing) stacks at the same spot — a garbled mess rather than an
 * obvious crash, so the normal try/catch never sees it.
 *
 * An element that explicitly opts into `aspect-ratio` is never *meant* to
 * render at 0×0, so a genuine collapse there is an unambiguous, low-noise
 * signal — unlike generic overlap detection, which would false-positive on
 * intentional overlays (badges, avatar stacks, tooltips).
 */
function findCollapsedAspectRatioBox(root: ParentNode): Element | null {
  for (const el of root.querySelectorAll("*")) {
    const style = window.getComputedStyle(el);
    if (style.aspectRatio === "auto" || style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return el;
  }
  return null;
}

const AXE_CONTRAST_RULES = new Set(["color-contrast"]);
const AXE_NAME_RULES = new Set([
  "button-name",
  "link-name",
  "aria-input-field-name",
  "input-button-name",
  "aria-command-name",
  "aria-toggle-field-name",
  "select-name",
  "image-alt",
  "area-alt",
]);

/**
 * QA mode's real, measured half — see prompts.ts's buildQaPrompt for why the
 * model only ever judges what's left (verification: "judgment"). Runs ONLY
 * inside a staged, same-origin preview: a hosted Storybook is cross-origin
 * and nothing — this included — can read into its DOM, which is the whole
 * reason QA stages its subject instead of pointing at the live story.
 */
async function runQaChecks(root: HTMLElement, enabledCriteriaIds: Set<string>): Promise<PreviewFrameQaFinding[]> {
  const findings: PreviewFrameQaFinding[] = [];
  const wantContrast = enabledCriteriaIds.has("a11y.contrast-text");
  const wantName = enabledCriteriaIds.has("a11y.accessible-name");

  if (wantContrast || wantName) {
    try {
      const axe = await import("axe-core");
      const ruleValues = [...(wantContrast ? AXE_CONTRAST_RULES : []), ...(wantName ? AXE_NAME_RULES : [])];
      const results = await axe.run(root, { runOnly: { type: "rule", values: ruleValues } });
      const summarize = (ruleIds: Set<string>, criterionId: string): PreviewFrameQaFinding => {
        const violation = results.violations.find((v) => ruleIds.has(v.id));
        if (violation) {
          const node = violation.nodes[0];
          const selector = node?.target?.join(" ") ?? "";
          const contrastData = node?.any?.find((c) => typeof c.data === "object" && c.data && "contrastRatio" in c.data)?.data as
            | { contrastRatio?: number }
            | undefined;
          const evidence = contrastData?.contrastRatio ? `${contrastData.contrastRatio.toFixed(1)}:1 on ${selector}` : selector;
          const detail = (node?.failureSummary ?? violation.help).replace(/^Fix (any|all) of the following:\s*/i, "");
          return { criterionId, status: "fail", evidence, detail };
        }
        const passed = results.passes.find((v) => ruleIds.has(v.id));
        if (passed) return { criterionId, status: "pass", evidence: "", detail: "No issues found." };
        return { criterionId, status: "not-applicable", evidence: "", detail: "Nothing in this preview to check." };
      };
      if (wantContrast) findings.push(summarize(AXE_CONTRAST_RULES, "a11y.contrast-text"));
      if (wantName) findings.push(summarize(AXE_NAME_RULES, "a11y.accessible-name"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "axe-core failed to run.";
      if (wantContrast) findings.push({ criterionId: "a11y.contrast-text", status: "warning", evidence: "", detail: message });
      if (wantName) findings.push({ criterionId: "a11y.accessible-name", status: "warning", evidence: "", detail: message });
    }
  }

  if (enabledCriteriaIds.has("a11y.keyboard-operable")) {
    // `cursor` is an inherited CSS property, so a real, already-keyboard-
    // operable control (a <button> with a styled inner <span> label, an
    // icon wrapper, etc.) computes `cursor: pointer` on every descendant
    // too — without excluding those, this flagged every span/div inside any
    // real button as if it were its own unreachable custom control.
    const suspects = Array.from(root.querySelectorAll("div, span")).filter((el) => {
      const style = window.getComputedStyle(el);
      if (style.cursor !== "pointer" || el.getAttribute("role") != null || el.hasAttribute("tabindex")) return false;
      return el.closest('button, a[href], input, select, textarea, label, [role], [tabindex]') == null;
    });
    findings.push(
      suspects.length > 0
        ? {
            criterionId: "a11y.keyboard-operable",
            status: "fail",
            evidence: `${suspects.length} element(s) styled clickable with no keyboard access`,
            detail: "Some elements look interactive (cursor: pointer) but have no role or tabindex, so a keyboard user can't reach them.",
          }
        : {
            criterionId: "a11y.keyboard-operable",
            status: "warning",
            evidence: "",
            detail: "No obvious keyboard traps found — this can't fully confirm keyboard operability, a manual pass is still worth doing.",
          },
    );
  }

  if (enabledCriteriaIds.has("a11y.target-size")) {
    const interactive = Array.from(
      root.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])'),
    );
    const tooSmall = interactive
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => (rect.width > 0 || rect.height > 0) && (rect.width < 24 || rect.height < 24));
    if (interactive.length === 0) {
      findings.push({ criterionId: "a11y.target-size", status: "not-applicable", evidence: "", detail: "No interactive controls in this preview." });
    } else if (tooSmall.length > 0) {
      const evidence = tooSmall
        .slice(0, 3)
        .map(({ el, rect }) => `${el.tagName.toLowerCase()} (${Math.round(rect.width)}×${Math.round(rect.height)}px)`)
        .join(", ");
      findings.push({
        criterionId: "a11y.target-size",
        status: "fail",
        evidence,
        detail: `${tooSmall.length} control(s) are smaller than 24×24px.`,
      });
    } else {
      findings.push({ criterionId: "a11y.target-size", status: "pass", evidence: "", detail: "Every interactive control is at least 24×24px." });
    }
  }

  if (enabledCriteriaIds.has("responsive.no-horizontal-overflow")) {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth + 1;
    findings.push({
      criterionId: "responsive.no-horizontal-overflow",
      status: overflow ? "fail" : "pass",
      evidence: overflow ? `Content is ${doc.scrollWidth}px wide in a ${doc.clientWidth}px viewport` : "",
      detail: overflow ? "The preview forces horizontal scrolling at this width." : "No horizontal overflow at this width.",
    });
  }

  if (enabledCriteriaIds.has("code.layout-collapse")) {
    const collapsed = findCollapsedAspectRatioBox(root);
    findings.push(
      collapsed
        ? {
            criterionId: "code.layout-collapse",
            status: "fail",
            evidence: `<${collapsed.tagName.toLowerCase()}${collapsed.className ? ` class="${collapsed.className}"` : ""}>`,
            detail: "This element declares aspect-ratio but rendered at 0 size — likely a percentage-sized wrapper with only absolutely-positioned children.",
          }
        : { criterionId: "code.layout-collapse", status: "pass", evidence: "", detail: "No collapsed layout boxes found." },
    );
  }

  return findings;
}

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error instanceof Error ? error.message : "The generated preview crashed while rendering.");
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

async function boot() {
  const root = document.getElementById("preview-root");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const modulePath = params.get("module");
  const theme = params.get("theme");
  const appearance = params.get("appearance");
  const density = params.get("density");
  // Comma-separated enabled criterion ids, present only for a QA run — see
  // QaPreviewFrame.tsx. Absent for a normal direction preview, which never
  // pays axe-core's load cost.
  const qaCriteriaParam = params.get("qaCriteria");
  if (theme) document.documentElement.setAttribute("data-ds-theme", theme);
  if (appearance) document.documentElement.setAttribute("data-ds-appearance", appearance);
  if (density) document.documentElement.setAttribute("data-ds-density", density);

  if (!modulePath) {
    reportError("No preview module was specified.");
    return;
  }

  try {
    // The module path is a runtime-computed, per-run value — Vite cannot statically analyze it.
    const mod = await import(/* @vite-ignore */ modulePath);
    const PreviewComponent = mod.default;
    if (typeof PreviewComponent !== "function") {
      reportError("The generated preview file has no default export component.");
      return;
    }
    getRoot(root).render(
      <StrictMode>
        <PreviewErrorBoundary>
          <PreviewComponent />
        </PreviewErrorBoundary>
      </StrictMode>,
    );
    // Give React a tick to render (and the error boundary a chance to catch) before declaring success.
    window.setTimeout(async () => {
      const collapsed = findCollapsedAspectRatioBox(root);
      if (collapsed) {
        reportError(
          `The preview's layout collapsed: <${collapsed.tagName.toLowerCase()}${collapsed.className ? ` class="${collapsed.className}"` : ""}> rendered at 0 size despite declaring aspect-ratio. This usually means it's sized purely by a percentage with no in-flow content to anchor it.`,
        );
        return;
      }
      if (qaCriteriaParam) {
        const enabledIds = new Set(qaCriteriaParam.split(",").map((id) => id.trim()).filter(Boolean));
        try {
          const findings = await runQaChecks(root as HTMLElement, enabledIds);
          window.parent.postMessage({ kind: PREVIEW_FRAME_QA_RESULT, findings }, "*");
        } catch {
          // Best-effort — the report simply shows fewer measured findings than expected.
        }
      }
      reportReady();
    }, 50);
  } catch (error) {
    reportError(error instanceof Error ? error.message : "The generated preview failed to load.");
  }
}

void boot();
