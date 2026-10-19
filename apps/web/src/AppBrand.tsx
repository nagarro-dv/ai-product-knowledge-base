import { BrainCircuit } from "lucide-react";
import "./AppBrand.css";

/**
 * The topbar brand: the product's icon and name. Clicking it goes back to
 * the knowledge base (e.g. from Settings).
 */
export function AppBrand({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" className="appBrand" onClick={onHome} aria-label="Product Knowledge Base — home">
      <span className="appBrand__logo" aria-hidden>
        <BrainCircuit size={15} strokeWidth={2} />
      </span>
      <span className="appBrand__title">Product Knowledge Base</span>
    </button>
  );
}
