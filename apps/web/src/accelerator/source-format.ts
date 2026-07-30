/**
 * Human-friendly labels for attached sources, so the composer never shows a
 * raw `https://www.figma.com/design/…` URL. The chip shows a short type +
 * name; the full value stays available on hover (title attribute).
 */

export type SourceChipKind = "figma" | "ticket" | "component";

const TYPE_LABEL: Record<SourceChipKind, string> = {
  figma: "Figma",
  ticket: "Jira",
  component: "Component",
};

export function sourceTypeLabel(kind: SourceChipKind): string {
  return TYPE_LABEL[kind];
}

/**
 * Pulls a readable name out of a Figma URL. Figma links look like
 * `https://www.figma.com/design/<key>/<File-Name-Slug>?node-id=1-2`; we prefer
 * the human file-name segment, fall back to the node id, then a generic label.
 */
export function figmaLabelFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean); // [design, key, Name-Slug]
    const nameSlug = segments[2];
    if (nameSlug) {
      const name = decodeURIComponent(nameSlug).replace(/[-_]+/g, " ").trim();
      if (name) return name;
    }
    const node = parsed.searchParams.get("node-id");
    if (node) return `Node ${node.replace(/-/g, ":")}`;
    return "Figma file";
  } catch {
    return "Figma file";
  }
}

/** The short name shown in a chip for a given source. `raw` is the href/value the source carries. */
export function sourceChipName(kind: SourceChipKind, raw: string, componentTitle?: string): string {
  if (kind === "figma") return figmaLabelFromUrl(raw);
  if (kind === "ticket") return raw.trim() || "Ticket";
  return componentTitle?.trim() || raw.trim() || "Component";
}
