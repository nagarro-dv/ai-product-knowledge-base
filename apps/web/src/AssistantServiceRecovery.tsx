import { AlertTriangle, RotateCw } from "lucide-react";
import { useState } from "react";
import { DsButton } from "./components/ds/Button";
import { DsTypography } from "./components/ds/DsTypography";
import { fetchLauncherStatus, restartAssistantService, waitForAssistantService } from "./launcherClient";
import "./AssistantServiceRecovery.css";

type Phase = "idle" | "restarting" | "waiting" | "failed";

/**
 * Replaces "make sure it's running (npm run dev:agent), then try again" with
 * an action the user can actually take from the app. Clicking Restart asks
 * the local launcher (a small always-on process — see apps/launcher) to
 * respawn the agent, then polls until it actually answers before handing
 * control back to the caller. If the launcher itself isn't reachable (the
 * user started the app the old way, without `npm run dev`), this says so
 * honestly instead of pretending the restart worked.
 */
export function AssistantServiceRecovery({ onRecovered }: { onRecovered: () => void | Promise<void> }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logsTail, setLogsTail] = useState<string[]>([]);

  const handleRestart = async () => {
    setPhase("restarting");
    setLogsTail([]);
    const started = await restartAssistantService();
    if (!started) {
      setPhase("failed");
      return;
    }
    setPhase("waiting");
    const recovered = await waitForAssistantService(20000);
    if (recovered) {
      setPhase("idle");
      await onRecovered();
      return;
    }
    const status = await fetchLauncherStatus();
    setLogsTail(status?.logsTail ?? []);
    setPhase("failed");
  };

  const busy = phase === "restarting" || phase === "waiting";

  return (
    <div className="assistantRecovery" role="alert">
      <div className="assistantRecovery__head">
        <AlertTriangle size={16} aria-hidden />
        <DsTypography as="p" variant="paragraph-regular">
          {phase === "failed"
            ? "Still couldn't reach it. If this keeps happening, run npm run dev in a terminal to see the full error."
            : "The assistant service isn't responding."}
        </DsTypography>
      </div>
      <DsButton
        variant="primary"
        size="mini"
        onClick={() => void handleRestart()}
        disabled={busy}
        leftIcon={busy ? <RotateCw size={12} className="assistantRecovery__spin" aria-hidden /> : undefined}
      >
        {phase === "restarting" ? "Restarting…" : phase === "waiting" ? "Starting…" : "Restart assistant service"}
      </DsButton>
      {phase === "failed" && logsTail.length > 0 ? (
        <details className="assistantRecovery__details">
          <summary>Details for developers</summary>
          <pre className="assistantRecovery__log">{logsTail.join("\n")}</pre>
        </details>
      ) : null}
    </div>
  );
}
