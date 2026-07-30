import { Component, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import "../index.css";
import { PREVIEW_FRAME_ERROR, PREVIEW_FRAME_READY } from "./previewFrameProtocol";

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
    window.setTimeout(() => {
      const collapsed = findCollapsedAspectRatioBox(root);
      if (collapsed) {
        reportError(
          `The preview's layout collapsed: <${collapsed.tagName.toLowerCase()}${collapsed.className ? ` class="${collapsed.className}"` : ""}> rendered at 0 size despite declaring aspect-ratio. This usually means it's sized purely by a percentage with no in-flow content to anchor it.`,
        );
        return;
      }
      reportReady();
    }, 50);
  } catch (error) {
    reportError(error instanceof Error ? error.message : "The generated preview failed to load.");
  }
}

void boot();
