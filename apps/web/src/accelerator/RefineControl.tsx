import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { DsButton } from "../components/ds/Button";
import { DsTypography } from "../components/ds/DsTypography";
import { AiAgentInput, type AiAgentInputSendPayload } from "../components/custom/AiAgentInput";
import "./RefineControl.css";

/**
 * The iteration loop: re-runs directions with the same sources plus an added
 * instruction and/or a newly attached source. Deliberately not "branching" or
 * manual code editing — this product has no code-editor surface, so refine +
 * regenerate is the whole iteration model. Reuses the same composer as the
 * rest of the product (intake, "Add context") rather than a bespoke input, so
 * it inherits proper sizing and source-attachment for free.
 */
export function RefineControl({
  onRefine,
}: {
  onRefine: (payload: AiAgentInputSendPayload) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  if (!open) {
    return (
      <DsButton
        ref={triggerRef}
        variant="secondary"
        size="small"
        leftIcon={<Pencil size={14} aria-hidden />}
        onClick={() => setOpen(true)}
      >
        Refine these directions
      </DsButton>
    );
  }

  return (
    <div className="accelerator__refineBox" role="group" aria-label="Refine directions">
      <div className="accelerator__refineBoxHeader">
        <DsTypography as="h3" variant="paragraph-small-bold" className="accelerator__refineBoxTitle">
          Refine these directions
        </DsTypography>
        <DsButton variant="ghost" size="mini" onClick={close}>
          Cancel
        </DsButton>
      </div>
      <AiAgentInput
        placeholder="What should change about these directions?"
        onSend={onRefine}
        sendLabel="Regenerate directions"
      />
    </div>
  );
}
