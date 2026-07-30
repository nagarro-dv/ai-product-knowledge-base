import { Bot, Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgentProvider } from "../agentSseClient";
import { resolveActiveAuthMethod } from "../aiProviders/authPreferences";
import { PROVIDER_ICONS, providerRowStatus, type ProviderRowStatus } from "../aiProviders/providerMeta";
import { DsTypography } from "../components/ds/DsTypography";
import { computeAnchoredPosition, type PopoverPosition } from "./popoverPosition";
import "./ProviderPicker.css";

/** Past this many providers, a flat unsorted list stops being scannable —
 * group by status and offer a search box rather than redesigning the menu
 * again for every future provider added. */
const SEARCH_THRESHOLD = 6;
const STATUS_RANK: Record<ProviderRowStatus, number> = { connected: 0, attention: 1, "not-connected": 2 };

/** What the engine backing this provider can actually do — derived from its
 * currently-active auth method, not asserted separately (so it can never
 * disagree with the capability that actually gates behavior elsewhere). */
function capabilitiesOf(provider: AgentProvider): string[] {
  const method = resolveActiveAuthMethod(provider);
  if (!method) return [];
  const caps = (method.mcpServers ?? []).map((server) => (server === "figma" ? "Figma" : server));
  if (method.capabilities?.localRepoEdits) caps.push("Edits files");
  return caps;
}

function statusText(provider: AgentProvider): string {
  const status = providerRowStatus(provider);
  if (status === "connected") {
    const method = resolveActiveAuthMethod(provider);
    return method ? `Connected via ${method.label}` : "Connected";
  }
  if (status === "attention") return "Needs attention";
  return "Not connected";
}

export function ProviderPicker({
  providers,
  selectedProviderId,
  onSelect,
  onManage,
}: {
  providers: AgentProvider[];
  selectedProviderId: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = providers.find((p) => p.id === selectedProviderId);
  const SelectedIcon = selected ? (PROVIDER_ICONS[selected.id] ?? Bot) : Bot;
  const selectedStatus = selected ? providerRowStatus(selected) : "not-connected";
  const showSearch = providers.length > SEARCH_THRESHOLD;

  // Connected engines first, then ones that need attention, then everything
  // else — so the list stays scannable no matter how many providers exist,
  // without the user having to hunt for the one that's actually usable.
  const sortedProviders = useMemo(
    () => [...providers].sort((a, b) => STATUS_RANK[providerRowStatus(a)] - STATUS_RANK[providerRowStatus(b)]),
    [providers],
  );
  const visibleProviders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedProviders;
    return sortedProviders.filter((p) => p.label.toLowerCase().includes(q));
  }, [sortedProviders, query]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(computeAnchoredPosition(triggerRef.current, 400));
    if (showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  if (!selected) return null;

  return (
    <div className="providerPicker">
      <button
        ref={triggerRef}
        type="button"
        className="providerPicker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="accelerator-provider-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="providerPicker__triggerIcon">
          <SelectedIcon size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <span className="providerPicker__triggerLabel">{selected.label}</span>
        <span
          className={`providerPicker__statusDot providerPicker__statusDot--${selectedStatus}`}
          aria-hidden
        />
        <ChevronDown size={14} className="providerPicker__triggerChevron" aria-hidden />
      </button>

      {open && position ? (
        <div
          id="accelerator-provider-menu"
          ref={popoverRef}
          role="listbox"
          aria-label="Choose AI engine"
          className="providerPicker__menu"
          style={{
            top: position.top,
            left: position.left,
            maxHeight: position.maxHeight,
            minWidth: Math.max(position.minWidth, 300),
          }}
        >
          {showSearch ? (
            <div className="providerPicker__search">
              <Search size={14} aria-hidden />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search engines…"
                aria-label="Search AI engines"
                className="providerPicker__searchInput"
              />
            </div>
          ) : null}
          <div className="providerPicker__menuList">
            {visibleProviders.length === 0 ? (
              <DsTypography as="p" variant="paragraph-small" className="providerPicker__empty">
                No engines match "{query}".
              </DsTypography>
            ) : null}
            {visibleProviders.map((provider) => {
              const Icon = PROVIDER_ICONS[provider.id] ?? Bot;
              const isSelected = provider.id === selectedProviderId;
              const caps = capabilitiesOf(provider);
              return (
                <button
                  key={provider.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!provider.ok}
                  className="providerPicker__row"
                  onClick={() => {
                    onSelect(provider.id);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="providerPicker__rowIcon">
                    <Icon size={18} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="providerPicker__rowBody">
                    <span className="providerPicker__rowHead">
                      <DsTypography as="span" variant="paragraph-small-bold">
                        {provider.label}
                      </DsTypography>
                      <span
                        className={`providerPicker__statusDot providerPicker__statusDot--${providerRowStatus(provider)}`}
                        aria-hidden
                      />
                    </span>
                    <DsTypography as="span" variant="paragraph-mini-regular" className="providerPicker__rowMeta">
                      {statusText(provider)}
                    </DsTypography>
                    {caps.length > 0 ? (
                      <span className="providerPicker__capabilities">
                        {caps.map((cap) => (
                          <span key={cap} className="providerPicker__capabilityChip">
                            {cap}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? <Check size={16} className="providerPicker__rowCheck" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
          <div className="providerPicker__menuFooter">
            <button
              type="button"
              className="providerPicker__manage"
              onClick={() => {
                setOpen(false);
                onManage();
              }}
            >
              Manage AI models…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
