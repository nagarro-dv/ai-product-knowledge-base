import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import {
  PREVIEW_FRAME_ERROR,
  PREVIEW_FRAME_QA_RESULT,
  PREVIEW_FRAME_READY,
  isPreviewFrameMessage,
  type PreviewFrameQaFinding,
} from "./previewFrameProtocol";
import "./DirectionPreviewFrame.css";

const LOAD_TIMEOUT_MS = 20000;

/**
 * Same staged, same-origin preview mechanism direction generation already
 * uses (DirectionPreviewFrame) — QA reuses it rather than pointing at the
 * live Storybook story, because a hosted Storybook is cross-origin and
 * nothing, DOM checks included, can read into it. The one addition is the
 * `qaCriteria` param, which tells previewFrameEntry.tsx to run its real DOM
 * checks and report them back instead of just ready/error.
 */
export function QaPreviewFrame({
  modulePath,
  enabledCriteriaIds,
  onResult,
}: {
  modulePath: string;
  enabledCriteriaIds: string[];
  onResult: (result: { status: "ready" | "failed"; message?: string; findings: PreviewFrameQaFinding[] }) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const findingsRef = useRef<PreviewFrameQaFinding[]>([]);
  // Unlike DirectionPreviewFrame (which reports this up through onMeasured
  // so ResponsivePreviewStage can size around it), QA renders this preview
  // directly with no such wrapper — so without measuring content ourselves,
  // .directionPreview's `height: 100%` has nothing definite to resolve
  // against inside .qaReport__previewColumn's auto-height column, and
  // collapses to the browser's small default iframe height instead.
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);

  const measureFit = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc?.documentElement) return;
      const contentHeight = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      if (contentHeight > 0) setMeasuredHeight(contentHeight);
    } catch {
      // Torn-down frame — leave the last known height.
    }
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
    setMeasuredHeight(null);
    findingsRef.current = [];
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isPreviewFrameMessage(event.data)) return;
      if (event.data.kind === PREVIEW_FRAME_QA_RESULT) {
        findingsRef.current = event.data.findings;
        return;
      }
      if (event.data.kind === PREVIEW_FRAME_READY) {
        setStatus("ready");
        onResult({ status: "ready", findings: findingsRef.current });
      } else if (event.data.kind === PREVIEW_FRAME_ERROR) {
        setStatus("failed");
        setErrorMessage(event.data.message);
        onResult({ status: "failed", message: event.data.message, findings: [] });
      }
    };
    window.addEventListener("message", onMessage);
    const timeout = window.setTimeout(() => {
      setStatus((current) => {
        if (current !== "loading") return current;
        onResult({ status: "failed", message: "Timed out waiting for the preview to load.", findings: [] });
        return "failed";
      });
      setErrorMessage((current) => current || "Timed out waiting for the preview to load.");
    }, LOAD_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulePath]);

  const theme = "default";
  const appearance = document.documentElement.getAttribute("data-ds-appearance") ?? "Light";
  const density = document.documentElement.getAttribute("data-ds-density") ?? "Standard";
  const src = `/preview-frame.html?module=${encodeURIComponent(modulePath)}&theme=${encodeURIComponent(theme)}&appearance=${encodeURIComponent(appearance)}&density=${encodeURIComponent(density)}&qaCriteria=${encodeURIComponent(enabledCriteriaIds.join(","))}`;

  return (
    // An explicit pixel height always, not the shared .directionPreview
    // class's own `height: 100%` — that only resolves correctly inside
    // DirectionCard's ResponsivePreviewStage (which gives it a definite
    // ancestor height); here there's no such ancestor, so height:100% would
    // collapse to the browser's small default iframe height. 240px matches
    // ResponsivePreviewStage's own placeholder convention until measured.
    <div className="directionPreview" ref={wrapRef} style={{ height: measuredHeight ?? 240 }}>
      {status === "loading" ? (
        <div className="directionPreview__status" aria-live="polite">
          <DsSpinner size={16} aria-hidden />
          <DsTypography as="p" variant="paragraph-small">
            Mounting the component…
          </DsTypography>
        </div>
      ) : null}
      {status === "failed" ? (
        <div className="directionPreview__status directionPreview__status--failed" role="status">
          <AlertTriangle size={16} aria-hidden />
          <DsTypography as="p" variant="paragraph-small">
            {errorMessage || "The component couldn't be mounted for checking."}
          </DsTypography>
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        src={src}
        title="QA preview"
        className="directionPreview__frame"
        style={{ visibility: status === "ready" ? "visible" : "hidden" }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
