/** postMessage protocol shared between previewFrameEntry.tsx (inside the iframe) and DirectionPreviewFrame.tsx (the parent). */
export const PREVIEW_FRAME_READY = "ds-accelerator-preview-ready";
export const PREVIEW_FRAME_ERROR = "ds-accelerator-preview-error";

export type PreviewFrameMessage =
  | { kind: typeof PREVIEW_FRAME_READY }
  | { kind: typeof PREVIEW_FRAME_ERROR; message: string };

export function isPreviewFrameMessage(value: unknown): value is PreviewFrameMessage {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === PREVIEW_FRAME_READY || kind === PREVIEW_FRAME_ERROR;
}
