/** postMessage protocol shared between previewFrameEntry.tsx (inside the iframe) and DirectionPreviewFrame.tsx / QaPreviewFrame.tsx (the parent). */
export const PREVIEW_FRAME_READY = "ds-accelerator-preview-ready";
export const PREVIEW_FRAME_ERROR = "ds-accelerator-preview-error";
export const PREVIEW_FRAME_QA_RESULT = "ds-accelerator-preview-qa-result";

/** One DOM-measured QA verdict — deliberately a subset of QaFinding's shape (no `verifiedBy`, the caller always knows it's automated/assisted since this only ever comes from a real runner). */
export type PreviewFrameQaFinding = {
  criterionId: string;
  status: "pass" | "fail" | "warning" | "not-applicable";
  evidence: string;
  detail: string;
};

export type PreviewFrameMessage =
  | { kind: typeof PREVIEW_FRAME_READY }
  | { kind: typeof PREVIEW_FRAME_ERROR; message: string }
  | { kind: typeof PREVIEW_FRAME_QA_RESULT; findings: PreviewFrameQaFinding[] };

export function isPreviewFrameMessage(value: unknown): value is PreviewFrameMessage {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === PREVIEW_FRAME_READY || kind === PREVIEW_FRAME_ERROR || kind === PREVIEW_FRAME_QA_RESULT;
}
