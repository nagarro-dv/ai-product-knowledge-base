import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  MODE_ATTR,
  type Mode,
  modeSnapshotKey,
  parseModeFromDoc,
  setModeOnDocument,
} from "./mode";

function subscribe(onStoreChange: () => void): () => void {
  const obs = new MutationObserver(() => onStoreChange());
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [MODE_ATTR.theme, MODE_ATTR.appearance, MODE_ATTR.density],
  });
  return () => obs.disconnect();
}

function getSnapshot(): string {
  return modeSnapshotKey(parseModeFromDoc(document.documentElement));
}

function getServerSnapshot(): string {
  return "default|Light|Standard";
}

export function useTokenMode(): {
  mode: Mode;
  setTheme: (t: Mode["theme"]) => void;
  setAppearance: (a: Mode["appearance"]) => void;
  setDensity: (d: Mode["density"]) => void;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mode = useMemo(() => parseModeFromDoc(document.documentElement), [snapshot]);

  const setTheme = useCallback((theme: Mode["theme"]) => {
    setModeOnDocument({ ...parseModeFromDoc(document.documentElement), theme });
  }, []);

  const setAppearance = useCallback((appearance: Mode["appearance"]) => {
    setModeOnDocument({ ...parseModeFromDoc(document.documentElement), appearance });
  }, []);

  const setDensity = useCallback((density: Mode["density"]) => {
    setModeOnDocument({ ...parseModeFromDoc(document.documentElement), density });
  }, []);

  return { mode, setTheme, setAppearance, setDensity };
}
