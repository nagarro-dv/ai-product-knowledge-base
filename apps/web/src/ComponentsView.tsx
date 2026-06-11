import type { Mode } from "@ds-starter/tokens";
import { AccordionShowcase } from "./components/ds/AccordionShowcase";
import { BadgeShowcase } from "./components/ds/BadgeShowcase";
import { BottomSheetShowcase } from "./components/ds/BottomSheetShowcase";
import { ButtonShowcase } from "./components/ds/ButtonShowcase";
import { CheckboxGroupShowcase } from "./components/ds/CheckboxGroupShowcase";
import { CheckboxShowcase } from "./components/ds/CheckboxShowcase";
import { CreditScoreShowcase } from "./components/ds/CreditScoreShowcase";
import { FlexibleRangeShowcase } from "./components/ds/FlexibleRangeShowcase";
import { IconButtonShowcase } from "./components/ds/IconButtonShowcase";
import { LinkButtonShowcase } from "./components/ds/LinkButtonShowcase";
import { ProgressArcShowcase } from "./components/ds/ProgressArcShowcase";
import { ProgressLinearShowcase } from "./components/ds/ProgressLinearShowcase";
import { RichCheckboxGroupShowcase } from "./components/ds/RichCheckboxGroupShowcase";
import { SliderShowcase } from "./components/ds/SliderShowcase";
import { SpinnerShowcase } from "./components/ds/SpinnerShowcase";
import { SuccessShowcase } from "./components/ds/SuccessShowcase";
import { TooltipShowcase } from "./components/ds/TooltipShowcase";
import { TypographyShowcase } from "./components/ds/TypographyShowcase";
import { WidgetShowcase } from "./components/ds/WidgetShowcase";
import { COMPONENT_REGISTRY, getComponentEntry, type ComponentId } from "./component-registry";
import { ModeControls } from "./ModeControls";
import { ComponentGalleryThumbnail } from "./playground/ComponentGalleryThumbnail";
import "./ComponentsView.css";

type Props = {
  mode: Mode;
  selectedId: ComponentId | null;
  onSelectComponent?: (id: ComponentId | null) => void;
  setTheme: (t: Mode["theme"]) => void;
  setAppearance: (a: Mode["appearance"]) => void;
  setDensity: (d: Mode["density"]) => void;
};

function headerLeadFromDescription(description: string): string {
  const body = description.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
  const sentenceEnd = body.search(/\.\s/);
  if (sentenceEnd !== -1 && sentenceEnd < 260) {
    return body.slice(0, sentenceEnd + 1);
  }
  if (body.length <= 220) return body;
  return `${body.slice(0, 217)}…`;
}

function renderShowcase(id: ComponentId) {
  switch (id) {
    case "accordion":
      return <AccordionShowcase />;
    case "bottom-sheet":
      return <BottomSheetShowcase />;
    case "icon-button":
      return <IconButtonShowcase />;
    case "tooltip":
      return <TooltipShowcase />;
    case "widget":
      return <WidgetShowcase />;
    case "link-button":
      return <LinkButtonShowcase />;
    case "button":
      return <ButtonShowcase />;
    case "badge":
      return <BadgeShowcase />;
    case "checkbox":
      return <CheckboxShowcase />;
    case "checkbox-group":
      return <CheckboxGroupShowcase />;
    case "rich-checkbox-group":
      return <RichCheckboxGroupShowcase />;
    case "progress-linear":
      return <ProgressLinearShowcase />;
    case "progress-arc":
      return <ProgressArcShowcase />;
    case "credit-score":
      return <CreditScoreShowcase />;
    case "slider":
      return <SliderShowcase />;
    case "flexible-range":
      return <FlexibleRangeShowcase />;
    case "spinner":
      return <SpinnerShowcase />;
    case "success":
      return <SuccessShowcase />;
    case "typography":
      return <TypographyShowcase />;
    default:
      return (
        <p className="components-preview-placeholder">
          Preview for this component is not wired yet.
        </p>
      );
  }
}

export function ComponentsView({
  mode,
  selectedId,
  onSelectComponent,
  setTheme,
  setAppearance,
  setDensity,
}: Props) {
  const selected = getComponentEntry(selectedId);

  return (
    <div className="components-view">
      <header className="app-header">
        <div className="app-header__titles">
          {selectedId && selected ? (
            <>
              <h1 className="components-view__pageHeading components-view__pageHeading--detail">
                {onSelectComponent ? (
                  <button
                    type="button"
                    className="components-view__crumbRoot"
                    onClick={() => onSelectComponent(null)}
                  >
                    Components
                  </button>
                ) : (
                  <span className="components-view__crumbRoot components-view__crumbRoot--static">
                    Components
                  </span>
                )}
                <span className="components-view__crumbSep" aria-hidden>
                  /
                </span>
                <span className="components-view__crumbCurrent">{selected.title}</span>
              </h1>
              <p className="app-header__lead">{headerLeadFromDescription(selected.description)}</p>
            </>
          ) : (
            <>
              <h1 className="components-view__pageHeading">Components</h1>
              <p className="app-header__lead">
                Browse the grid or sidebar, then open a component for the full preview.
              </p>
            </>
          )}
        </div>
        <ModeControls
          mode={mode}
          setTheme={setTheme}
          setAppearance={setAppearance}
          setDensity={setDensity}
        />
      </header>

      <div className="components-view__body">
        {!selectedId && (
          <section className="components-view__landing" aria-label="Component showcases">
            <ul className="components-view__grid">
              {COMPONENT_REGISTRY.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="components-view__gridCard"
                    onClick={() => onSelectComponent?.(entry.id)}
                  >
                    <span className="components-view__gridCardMeta">
                      <span className="components-view__gridCardTitleRow">
                        <span className="components-view__gridCardTitle">{entry.title}</span>
                      </span>
                    </span>
                    <span className="components-view__gridCardThumb" aria-hidden="true">
                      <ComponentGalleryThumbnail componentId={entry.id} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {selected && (
          <div className="components-view__selected" key={`${selected.id}-${mode.appearance}-${mode.theme}`}>
            <div
              className="components-preview-panel components-preview-panel--live"
              aria-label={`${selected.title} showcase`}
            >
              {renderShowcase(selected.id)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
