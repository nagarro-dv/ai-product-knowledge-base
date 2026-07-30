import { ArrowUpRight, History as HistoryIcon, X } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";
import { DsButton } from "../components/ds/Button";
import { DsIconButton } from "../components/ds/IconButton";
import { DsTypography } from "../components/ds/DsTypography";
import type { RunHistoryEntry, RunHistoryOutcome } from "./runHistory";
import "./HistoryDrawer.css";

const OUTCOME_LABEL: Record<RunHistoryOutcome, string> = {
  applied: "Applied",
  stopped: "Stopped",
  error: "Error",
};

function relativeTime(savedAt: number): string {
  const minutes = Math.round((Date.now() - savedAt) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function HistoryDrawer({
  entries,
  onClose,
  onRestore,
  onClear,
  returnFocusRef,
}: {
  entries: RunHistoryEntry[];
  onClose: () => void;
  onRestore: (entry: RunHistoryEntry) => void;
  onClear: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const titleId = "accelerator-history-title";
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    onClose();
    returnFocusRef?.current?.focus();
  };

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="historyDrawer__root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="historyDrawer__backdrop" aria-label="Close" onClick={close} />
      <div className="historyDrawer">
        <header className="historyDrawer__header">
          <div className="historyDrawer__headerTitles">
            <DsTypography as="h2" id={titleId} variant="heading-5">
              Recent runs
            </DsTypography>
            <DsTypography as="p" variant="paragraph-mini-regular" className="historyDrawer__note">
              Stored on this device only — not shared with your team.
            </DsTypography>
          </div>
          <DsIconButton ref={closeButtonRef} variant="ghost" size="small" aria-label="Close" onClick={close}>
            <X size={16} aria-hidden />
          </DsIconButton>
        </header>

        {entries.length === 0 ? (
          <div className="historyDrawer__empty">
            <span className="historyDrawer__emptyIcon" aria-hidden>
              <HistoryIcon size={20} strokeWidth={1.6} />
            </span>
            <DsTypography as="p" variant="paragraph-small-bold">
              No runs yet
            </DsTypography>
            <DsTypography as="p" variant="paragraph-mini-regular" className="historyDrawer__emptyHint">
              Every request you send shows up here, so you can pick up where you left off.
            </DsTypography>
          </div>
        ) : (
          <ul className="historyDrawer__list">
            {entries.map((entry) => (
              <li key={entry.id} className="historyDrawer__item">
                <button
                  type="button"
                  className="historyDrawer__card"
                  onClick={() => onRestore(entry)}
                  aria-label={`Use "${entry.targetLabel}" as a starting point`}
                >
                  <span className="historyDrawer__cardTop">
                    <DsTypography as="span" variant="paragraph-bold" className="historyDrawer__title">
                      {entry.targetLabel}
                    </DsTypography>
                    <ArrowUpRight size={16} className="historyDrawer__affordance" aria-hidden />
                  </span>
                  <DsTypography as="span" variant="paragraph-small" className="historyDrawer__summary">
                    {entry.contextSummary}
                  </DsTypography>
                  <span className="historyDrawer__meta">
                    <span className={`historyDrawer__statusDot historyDrawer__statusDot--${entry.outcome}`} aria-hidden />
                    <span>{OUTCOME_LABEL[entry.outcome]}</span>
                    {entry.provider ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{entry.provider}</span>
                      </>
                    ) : null}
                    <span aria-hidden>·</span>
                    <span>{relativeTime(entry.savedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {entries.length > 0 ? (
          <footer className="historyDrawer__footer">
            <DsTypography as="span" variant="paragraph-mini-regular" className="historyDrawer__count">
              {entries.length} run{entries.length === 1 ? "" : "s"}
            </DsTypography>
            <DsButton variant="ghost" size="mini" onClick={onClear}>
              Clear history
            </DsButton>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
