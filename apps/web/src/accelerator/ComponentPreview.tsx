import type { ComponentId } from "../component-registry";
import { CreditScoreShowcase } from "../components/ds/CreditScoreShowcase";
import { ButtonShowcase } from "../components/ds/ButtonShowcase";
import { BadgeShowcase } from "../components/ds/BadgeShowcase";
import { AccordionShowcase } from "../components/ds/AccordionShowcase";
import { ComponentGalleryThumbnail } from "../playground/ComponentGalleryThumbnail";
import "./ComponentPreview.css";

type Props = {
  componentId: string;
  compact?: boolean;
};

function renderShowcase(componentId: ComponentId) {
  switch (componentId) {
    case "credit-score":
      return <CreditScoreShowcase />;
    case "button":
      return <ButtonShowcase />;
    case "badge":
      return <BadgeShowcase />;
    case "accordion":
      return <AccordionShowcase />;
    default:
      return (
        <div className="component-preview__fallback">
          <ComponentGalleryThumbnail componentId={componentId as ComponentId} />
          <p>Open Components to see the full {componentId} showcase.</p>
        </div>
      );
  }
}

/** Renders a live component preview for the accelerator panels. */
export function ComponentPreview({ componentId, compact = false }: Props) {
  return (
    <div className={compact ? "component-preview component-preview--compact" : "component-preview"}>
      {renderShowcase(componentId as ComponentId)}
    </div>
  );
}
