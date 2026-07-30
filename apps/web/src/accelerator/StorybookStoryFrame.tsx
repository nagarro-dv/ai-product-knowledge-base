import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import "./StorybookStoryFrame.css";

/**
 * Renders a real story from the connected Storybook in isolation via its
 * standard `iframe.html?id=<storyId>` endpoint — the component as the team
 * actually ships it, not a local approximation.
 *
 * Some Storybooks (BBC's iPlayer one among them, verified live) send
 * `X-Frame-Options`/CSP `frame-ancestors` that block embedding entirely.
 * The browser's `<iframe>` `load` event still fires in that case — there is
 * no reliable, cross-origin way for this page to detect the block and show
 * a "couldn't embed" message instead. So the honest fix isn't better
 * detection, it's never depending on the embed alone: an "Open in
 * Storybook" link is always shown and always works, regardless of whether
 * the frame renders.
 */
export function StorybookStoryFrame({ url, storyId, title }: { url: string; storyId: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const src = `${url}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;

  return (
    <div className="storybookFrame">
      <div className="storybookFrame__canvas">
        {!loaded ? (
          <div className="storybookFrame__loading" aria-live="polite">
            <DsSpinner size={16} aria-hidden />
            <DsTypography as="p" variant="paragraph-small">
              Loading from Storybook…
            </DsTypography>
          </div>
        ) : null}
        <iframe
          src={src}
          title={`Storybook preview: ${title}`}
          className="storybookFrame__iframe"
          style={{ visibility: loaded ? "visible" : "hidden" }}
          onLoad={() => setLoaded(true)}
        />
      </div>
      <a href={src} target="_blank" rel="noreferrer" className="storybookFrame__openLink">
        Open in Storybook
        <ExternalLink size={11} aria-hidden />
      </a>
    </div>
  );
}
