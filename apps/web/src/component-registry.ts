export type ComponentRegistryEntry = {
  id: string;
  title: string;
  description: string;
};

export const COMPONENT_REGISTRY: readonly ComponentRegistryEntry[] = [
  { id: "accordion", title: "Accordion", description: "Stacked headings that expand to reveal content." },
  { id: "bottom-sheet", title: "Bottom Sheet", description: "Slide-up drawer with handle, title, content, and footer actions." },
  { id: "bottom-navigation", title: "Bottom Navigation", description: "Tab bar with home indicator region." },
  { id: "icon-button", title: "Icon Button", description: "Icon-only actions for compact toolbars." },
  { id: "tooltip", title: "Tooltip", description: "Context label on hover or focus." },
  { id: "widget", title: "Widget", description: "Card shell with slot content." },
  { id: "link-button", title: "Link Button", description: "Text-style action with link semantics." },
  { id: "button", title: "Button", description: "Primary actions — multiple variants and sizes." },
  { id: "badge", title: "Badge", description: "Pill labels for status and metadata." },
  { id: "checkbox", title: "Checkbox", description: "Selection control with full state matrix." },
  { id: "checkbox-group", title: "Checkbox Group", description: "Labeled checkbox row — inline or block." },
  { id: "rich-checkbox-group", title: "Rich Checkbox Group", description: "Card-like checkbox row with optional second line." },
  { id: "progress-linear", title: "Progress Linear", description: "Determinate progress bar with semantic variants." },
  { id: "progress-arc", title: "Progress Arc", description: "Semicircular gauge with endpoint labels." },
  { id: "credit-score", title: "Credit Score", description: "Score card with arc gauge, trend, and status badge." },
  { id: "slider", title: "Slider", description: "Horizontal slider — single thumb or range." },
  { id: "flexible-range", title: "Flexible Range", description: "Widget card with triple-range slider and actions." },
  { id: "spinner", title: "Spinner", description: "Indeterminate loading indicator." },
  { id: "success", title: "Success", description: "Centered outcome module with icon, title, and description." },
  { id: "typography", title: "Typography", description: "Token-bound text styles for headings and body." },
] as const;

export type ComponentId = (typeof COMPONENT_REGISTRY)[number]["id"];

export function getComponentEntry(id: string | null | undefined): ComponentRegistryEntry | undefined {
  return COMPONENT_REGISTRY.find((entry) => entry.id === id);
}
