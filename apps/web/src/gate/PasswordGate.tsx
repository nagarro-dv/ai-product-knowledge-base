import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BrandLogo } from "../AppBrand";
import { DsIconButton } from "../components/ds/IconButton";
import { GateBackdrop } from "./GateBackdrop";
import { GATE_ENABLED, isUnlocked, unlock } from "./gateClient";
import "./PasswordGate.css";

/** The arrow enables once at least this many characters are typed. */
const MIN_LENGTH = 4;

/**
 * Stands in front of the whole app on the hosted site until the shared
 * password is entered: a blurred, non-interactive impression of the product,
 * one password field in the middle, and a line about the project at the
 * bottom. The password itself is checked on the server; see gateClient.ts.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "unlocked">(GATE_ENABLED ? "checking" : "unlocked");

  useEffect(() => {
    if (!GATE_ENABLED) return;
    let cancelled = false;
    void isUnlocked().then((unlocked) => {
      if (!cancelled) setState(unlocked ? "unlocked" : "locked");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "unlocked") return <>{children}</>;
  return (
    <div className="passwordGate">
      <GateBackdrop />
      {state === "locked" ? <GateForm onUnlocked={() => setState("unlocked")} /> : null}
      <footer className="passwordGate__about">
        <span className="passwordGate__product">
          <BrandLogo />
          Product Knowledge Base
        </span>
        <p>
          A prototype by{" "}
          <a href="https://www.nagarro.com" target="_blank" rel="noopener noreferrer">
            Nagarro
          </a>{" "}
          exploring how AI agents can turn a product team's scattered tools into evidence-backed initiatives.
        </p>
      </footer>
    </div>
  );
}

function GateForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ready = password.length >= MIN_LENGTH && !checking;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setChecking(true);
    setError(null);
    try {
      await unlock(password);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That password isn't right.");
      setChecking(false);
      setPassword("");
      inputRef.current?.focus();
    }
  };

  return (
    <form className="passwordGate__form" onSubmit={submit}>
      <label htmlFor="gate-password" className="passwordGate__label">
        Password
      </label>
      <div className="passwordGate__field" data-invalid={error ? true : undefined}>
        <input
          ref={inputRef}
          id="gate-password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "gate-error" : undefined}
        />
        <DsIconButton variant="primary" size="small" type="submit" aria-label="Enter" disabled={!ready}>
          <ArrowUp size={16} aria-hidden />
        </DsIconButton>
      </div>
      <p id="gate-error" className="passwordGate__error" role="alert">
        {error ?? ""}
      </p>
    </form>
  );
}
