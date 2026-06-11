import type { ReactNode } from "react";
import { DsAccordion } from "../components/ds/Accordion";
import { DsBadge } from "../components/ds/Badge";
import { DsButton } from "../components/ds/Button";
import { DsCheckbox } from "../components/ds/Checkbox";
import { DsCheckboxGroup } from "../components/ds/CheckboxGroup";
import { DsIconButton, DsIconButtonIconPlaceholder } from "../components/ds/IconButton";
import { DsLinkButton } from "../components/ds/LinkButton";
import { DsProgressArc } from "../components/ds/ProgressArc";
import { DsProgressLinear } from "../components/ds/ProgressLinear";
import { DsSpinner } from "../components/ds/Spinner";
import { DsTypography } from "../components/ds/DsTypography";
import { Widget } from "../components/ds/Widget";
import { DsCreditScore } from "../components/ds/CreditScore";
import type { ComponentId } from "../component-registry";
import "./ComponentGalleryThumbnail.css";

type Props = {
  componentId: ComponentId;
};

function ThumbRoot({ compact, children }: { compact?: boolean; children: ReactNode }) {
  return (
    <div
      className={
        compact
          ? "component-gallery-thumb component-gallery-thumb--root component-gallery-thumb--compact"
          : "component-gallery-thumb component-gallery-thumb--root"
      }
    >
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return <div className="component-gallery-thumb__placeholder">{children}</div>;
}

/** Compact visual for the Components landing grid only (`pointer-events: none` on parent). */
export function ComponentGalleryThumbnail({ componentId }: Props) {
  switch (componentId) {
    case "button":
      return (
        <ThumbRoot compact>
          <div className="component-gallery-thumb__row">
            <DsButton variant="primary" size="small">
              Primary
            </DsButton>
            <DsButton variant="secondary" size="small">
              Secondary
            </DsButton>
            <DsButton variant="ghost" size="small">
              Ghost
            </DsButton>
          </div>
        </ThumbRoot>
      );

    case "icon-button":
      return (
        <ThumbRoot compact>
          <div className="component-gallery-thumb__row">
            <DsIconButton variant="primary" size="regular" aria-label="Add">
              <DsIconButtonIconPlaceholder />
            </DsIconButton>
            <DsIconButton variant="ghost" size="regular" aria-label="More">
              <DsIconButtonIconPlaceholder />
            </DsIconButton>
          </div>
        </ThumbRoot>
      );

    case "badge":
      return (
        <ThumbRoot compact>
          <div className="component-gallery-thumb__row">
            <DsBadge variant="primary">New</DsBadge>
            <DsBadge variant="success">OK</DsBadge>
            <DsBadge variant="neutral">3</DsBadge>
          </div>
        </ThumbRoot>
      );

    case "checkbox":
      return (
        <ThumbRoot compact>
          <DsCheckbox checked state="default" interactive={false} aria-label="Preview" />
        </ThumbRoot>
      );

    case "checkbox-group":
      return (
        <ThumbRoot compact>
          <DsCheckboxGroup label="Option" layout="inline" />
        </ThumbRoot>
      );

    case "rich-checkbox-group":
      return (
        <ThumbRoot compact>
          <Placeholder>
            <span className="component-gallery-thumb__placeholderText">Rich checkbox row</span>
          </Placeholder>
        </ThumbRoot>
      );

    case "link-button":
      return (
        <ThumbRoot compact>
          <DsLinkButton variant="primary" size="default">
            Learn more
          </DsLinkButton>
        </ThumbRoot>
      );

    case "tooltip":
      return (
        <ThumbRoot compact>
          <Placeholder>
            <span className="component-gallery-thumb__placeholderText">Tooltip on hover</span>
          </Placeholder>
        </ThumbRoot>
      );

    case "spinner":
      return (
        <ThumbRoot compact>
          <DsSpinner size={24} aria-label="Loading" />
        </ThumbRoot>
      );

    case "accordion":
      return (
        <ThumbRoot>
          <DsAccordion
            title="Section"
            variant="contained"
            size="regular"
            defaultOpen={false}
          >
            Preview content
          </DsAccordion>
        </ThumbRoot>
      );

    case "progress-linear":
      return (
        <ThumbRoot compact>
          <DsProgressLinear value={62} variant="primary" showLabel />
        </ThumbRoot>
      );

    case "progress-arc":
      return (
        <ThumbRoot compact>
          <DsProgressArc value={72} variant="default" />
        </ThumbRoot>
      );

    case "typography":
      return (
        <ThumbRoot compact>
          <div className="component-gallery-thumb__stack">
            <DsTypography as="span" variant="heading-4">
              Heading 4
            </DsTypography>
            <DsTypography as="span" variant="paragraph-small">
              Body sample
            </DsTypography>
          </div>
        </ThumbRoot>
      );

    case "widget":
      return (
        <ThumbRoot>
          <Widget>
            <DsTypography as="p" variant="paragraph-small">
              Widget content
            </DsTypography>
          </Widget>
        </ThumbRoot>
      );

  case "credit-score":
    return (
      <ThumbRoot>
        <DsCreditScore score={724} badge="Good" trend="↑ 12 pts" provider="Demo bureau" />
      </ThumbRoot>
    );

  case "slider":
  case "flexible-range":
  case "bottom-sheet":
  case "bottom-navigation":
  case "success":
    return (
      <ThumbRoot compact>
        <Placeholder>
          <span className="component-gallery-thumb__placeholderMark" aria-hidden>
            ◇
          </span>
          <span className="component-gallery-thumb__placeholderText">Open for details</span>
        </Placeholder>
      </ThumbRoot>
    );

    default:
      return (
        <ThumbRoot compact>
          <Placeholder>
            <span className="component-gallery-thumb__placeholderMark" aria-hidden>
              ◇
            </span>
            <span className="component-gallery-thumb__placeholderText">Open for details</span>
          </Placeholder>
        </ThumbRoot>
      );
  }
}
