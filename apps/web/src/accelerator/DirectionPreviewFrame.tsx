import { AlertTriangle, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DsButton } from "../components/ds/Button";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import { PREVIEW_FRAME_ERROR, PREVIEW_FRAME_READY, isPreviewFrameMessage } from "./previewFrameProtocol";
import "./DirectionPreviewFrame.css";

const LOAD_TIMEOUT_MS = 20000;

/**
 * Renders a direction's real generated code in an isolated same-origin iframe via
 * Vite's on-demand dev transform — never a static/fake image. "unavailable" and
 * "failed" are shown honestly rather than falling back to a placeholder.
 */
export function DirectionPreviewFrame({
  modulePath,
  onStatusChange,
  onMeasured,
}: {
  modulePath: string;
  onStatusChange?: (status: "ready" | "failed", message?: string) => void;
  /** Reports the iframe's real, unscaled content size once rendered — the
   *  stage uses this to size itself exactly to content instead of imposing
   *  a fixed height (which either strands empty space or forces internal
   *  scrolling depending on how tall the generated preview actually is). */
  onMeasured?: (size: { width: number; height: number }) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  // Bumped by the "Retry preview" action — forces the iframe `src` to change
  // (see below) so the browser genuinely reloads it, without re-running the
  // whole (expensive, AI-generation) run just to recover one broken preview.
  const [retryToken, setRetryToken] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Generated content wider than the frame is scaled to fit as one unit —
  // a preview must never grow a horizontal scrollbar. Same-origin iframe, so
  // the real content width is measurable directly.
  const [fitScale, setFitScale] = useState(1);

  const measureFit = useCallback(() => {
    try {
      const wrap = wrapRef.current;
      const doc = iframeRef.current?.contentDocument;
      if (!wrap || !doc?.documentElement) return;
      const containerWidth = wrap.clientWidth;
      const contentWidth = Math.max(doc.documentElement.scrollWidth, doc.body?.scrollWidth ?? 0);
      const contentHeight = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      const next = contentWidth > containerWidth + 1 ? containerWidth / contentWidth : 1;
      setFitScale((current) => (Math.abs(current - next) > 0.01 ? next : current));
      onMeasured?.({ width: contentWidth, height: contentHeight });
    } catch {
      // Cross-origin or torn-down frame — leave unscaled.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    measureFit();
    // Fonts/images settle a beat after the ready message.
    const settle = window.setTimeout(measureFit, 350);
    const observer = new ResizeObserver(measureFit);
    if (wrapRef.current) observer.observe(wrapRef.current);
    return () => {
      window.clearTimeout(settle);
      observer.disconnect();
    };
  }, [status, measureFit]);

  useEffect(() => {
    setStatus("loading");
    setErrorMessage("");
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isPreviewFrameMessage(event.data)) return;
      if (event.data.kind === PREVIEW_FRAME_READY) {
        setStatus("ready");
        onStatusChange?.("ready");
      } else if (event.data.kind === PREVIEW_FRAME_ERROR) {
        setStatus("failed");
        setErrorMessage(event.data.message);
        onStatusChange?.("failed", event.data.message);
      }
    };
    window.addEventListener("message", onMessage);
    const timeout = window.setTimeout(() => {
      setStatus((current) => {
        if (current !== "loading") return current;
        onStatusChange?.("failed", "Timed out waiting for the preview to load.");
        return "failed";
      });
      setErrorMessage((current) => current || "Timed out waiting for the preview to load.");
    }, LOAD_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulePath, retryToken]);

  // The preview renders the CONNECTED design system's own look, never the
  // Accelerator tool's own branding — they're different products, and
  // whatever theme the tool's chrome currently wears (e.g. Nagarro) has
  // nothing to do with what the target codebase actually looks like.
  // Appearance/density are legitimate to sync (light/dark, spacing are
  // display preferences, not brand identity); theme is hard-pinned.
  const theme = "default";
  const appearance = document.documentElement.getAttribute("data-ds-appearance") ?? "Light";
  const density = document.documentElement.getAttribute("data-ds-density") ?? "Standard";
  const src = `/preview-frame.html?module=${encodeURIComponent(modulePath)}&theme=${encodeURIComponent(theme)}&appearance=${encodeURIComponent(appearance)}&density=${encodeURIComponent(density)}${retryToken > 0 ? `&retry=${retryToken}` : ""}`;

  return (
    <div className="directionPreview" ref={wrapRef}>
      {status === "loading" ? (
        <div className="directionPreview__status" aria-live="polite">
          <DsSpinner size={16} aria-hidden />
          <DsTypography as="p" variant="paragraph-small">
            Loading preview…
          </DsTypography>
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="directionPreview__status directionPreview__status--failed" role="status">
          <AlertTriangle size={16} aria-hidden />
          <div className="directionPreview__failedBody">
            <DsTypography as="p" variant="paragraph-small-bold">
              Preview unavailable
            </DsTypography>
            <DsTypography as="p" variant="paragraph-mini-regular">
              {errorMessage || "The generated preview couldn't be rendered."}
            </DsTypography>
            <DsButton
              variant="secondary"
              size="mini"
              leftIcon={<RotateCw size={12} aria-hidden />}
              onClick={() => setRetryToken((n) => n + 1)}
            >
              Retry preview
            </DsButton>
          </div>
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        src={src}
        title="Direction preview"
        className="directionPreview__frame"
        style={{
          visibility: status === "ready" ? "visible" : "hidden",
          width: `${100 / fitScale}%`,
          height: `${100 / fitScale}%`,
          transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
          transformOrigin: "top left",
        }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
