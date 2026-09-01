import { useMemo, useState, type RefObject } from "react";
import { ChevronRight, Folder, Search as SearchIcon, X } from "lucide-react";
import type { StorybookComponent } from "../../integrations/storybookClient";
import "./ComponentPicker.css";

export type ComponentPickerProps = {
  components: StorybookComponent[];
  loading?: boolean;
  selected: StorybookComponent | null;
  onSelect: (component: StorybookComponent) => void;
  /** Forwarded to the search input so a parent modal's open-focus effect still lands on it. */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Controlled — the toggle itself lives in the modal header (next to Close), not in
   * this component, so the parent owns whether the field is open. */
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
};

/** Path segments between the root and a component's own name — e.g. ["Design System", "Actions"] for a component whose `path` is "Design System/Actions/Button". A component with no slash in `path` lives at the root. */
function folderOf(component: StorybookComponent): string[] {
  return component.path.split("/").slice(0, -1);
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((segment, i) => segment === b[i]);
}

/**
 * Browsable, searchable picker for a Storybook component index. With the
 * search box empty it's a folder drilldown driven entirely by each
 * component's `path` — whatever category structure the source Storybook
 * (real or demo) happens to use. Typing searches the full index flatly,
 * regardless of which folder is open.
 */
export function ComponentPicker({
  components,
  loading,
  selected,
  onSelect,
  inputRef,
  searchOpen,
  onSearchOpenChange,
}: ComponentPickerProps) {
  const [search, setSearch] = useState("");
  const [folderPath, setFolderPath] = useState<string[]>([]);

  const query = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!query) return null;
    return components.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.path.toLowerCase().includes(query) ||
        c.importPath?.toLowerCase().includes(query),
    );
  }, [components, query]);

  const { subfolders, items } = useMemo(() => {
    const counts = new Map<string, number>();
    const direct: StorybookComponent[] = [];
    for (const component of components) {
      const folder = folderOf(component);
      if (folder.length > folderPath.length && samePath(folder.slice(0, folderPath.length), folderPath)) {
        const name = folder[folderPath.length];
        counts.set(name, (counts.get(name) ?? 0) + 1);
      } else if (samePath(folder, folderPath)) {
        direct.push(component);
      }
    }
    return { subfolders: [...counts.entries()], items: direct };
  }, [components, folderPath]);

  const renderOption = (component: StorybookComponent) => (
    <button
      key={component.id}
      type="button"
      className={
        selected?.id === component.id
          ? "componentPicker__option componentPicker__option--selected"
          : "componentPicker__option"
      }
      onClick={() => onSelect(component)}
    >
      <span className="componentPicker__optionTitle">{component.title}</span>
      <span className="componentPicker__optionId">{component.importPath ?? component.path}</span>
    </button>
  );

  return (
    <div className="componentPicker">
      {searchOpen ? (
        <div className="componentPicker__searchRow">
          <SearchIcon size={14} aria-hidden />
          <input
            ref={inputRef}
            className="componentPicker__searchInput"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type component name"
            autoFocus
          />
          <button
            type="button"
            className="componentPicker__searchClose"
            aria-label="Close search"
            onClick={() => {
              onSearchOpenChange(false);
              setSearch("");
            }}
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ) : (
        <nav className="componentPicker__breadcrumb" aria-label="Component folder">
          <button
            type="button"
            className="componentPicker__crumb"
            aria-current={folderPath.length === 0 ? "location" : undefined}
            onClick={() => setFolderPath([])}
          >
            All components
          </button>
          {folderPath.map((segment, index) => {
            const isCurrent = index === folderPath.length - 1;
            return (
              <span key={index} className="componentPicker__crumbGroup">
                <ChevronRight size={12} aria-hidden className="componentPicker__crumbSep" />
                {isCurrent ? (
                  <span className="componentPicker__crumbCurrent" aria-current="location">
                    {segment}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="componentPicker__crumb"
                    onClick={() => setFolderPath(folderPath.slice(0, index + 1))}
                  >
                    {segment}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {loading ? (
        <span className="componentPicker__caption" aria-live="polite">
          Loading components…
        </span>
      ) : searchOpen ? (
        <span className="componentPicker__caption" aria-live="polite">
          {`${searchResults?.length ?? 0} match${searchResults?.length === 1 ? "" : "es"}`}
        </span>
      ) : null}

      <div className="componentPicker__results">
        {loading ? null : query ? (
          searchResults && searchResults.length > 0 ? (
            searchResults.map(renderOption)
          ) : (
            <span className="componentPicker__empty">No components match that search.</span>
          )
        ) : (
          <>
            {subfolders.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className="componentPicker__folder"
                onClick={() => setFolderPath((p) => [...p, name])}
              >
                <Folder size={15} strokeWidth={1.8} aria-hidden className="componentPicker__folderIcon" />
                <span className="componentPicker__folderName">{name}</span>
                <span className="componentPicker__folderCount">{count}</span>
                <ChevronRight size={14} aria-hidden className="componentPicker__folderChevron" />
              </button>
            ))}
            {items.map(renderOption)}
            {subfolders.length === 0 && items.length === 0 ? (
              <span className="componentPicker__empty">No components in this folder.</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
