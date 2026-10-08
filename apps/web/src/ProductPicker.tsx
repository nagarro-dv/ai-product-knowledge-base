import { Brain, BrainCircuit, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { computeAnchoredPosition, type PopoverPosition } from "./accelerator/popoverPosition";
import { DsTypography } from "./components/ds/DsTypography";
import { PRODUCTS, productMeta, type ProductId } from "./products";
import "./ProductPicker.css";

/** The coloured tile each product is recognised by — green code brackets for
 *  DS Accelerator, a purple brain for the Product Knowledge Base (a circuit
 *  brain on deeper indigo for v2, so the two versions read apart). */
export function ProductLogo({ product, size = "md" }: { product: ProductId; size?: "md" | "lg" }) {
  const iconSize = size === "lg" ? 17 : 15;
  return (
    <span className={`productLogo productLogo--${product} productLogo--${size}`} aria-hidden>
      {product === "knowledge-base" ? (
        <Brain size={iconSize} strokeWidth={2} />
      ) : product === "knowledge-base-v2" ? (
        <BrainCircuit size={iconSize} strokeWidth={2} />
      ) : (
        <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="none">
          <path
            d="M9 6.5 4 12l5 5.5M15 6.5 20 12l-5 5.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/**
 * Replaces the topbar's old brand button. Picking a product (including the
 * one already active) lands on that product's home screen, so the brand still
 * doubles as the way home.
 */
export function ProductPicker({
  selected,
  onSelect,
}: {
  selected: ProductId;
  onSelect: (product: ProductId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const current = productMeta(selected);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(computeAnchoredPosition(triggerRef.current, 320));
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

  // Focus the current product once the menu has actually mounted (it only
  // renders after `position` is computed), so arrow keys work straight away.
  useEffect(() => {
    if (open && position) {
      popoverRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    }
  }, [open, position]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const rows = Array.from(popoverRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % rows.length : (index - 1 + rows.length) % rows.length;
    rows[next]?.focus();
  };

  return (
    <div className="productPicker">
      <button
        ref={triggerRef}
        type="button"
        className="productPicker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="product-picker-menu"
        aria-label={`${current.label} — switch product`}
        onClick={() => setOpen((v) => !v)}
      >
        <ProductLogo product={selected} />
        <span className="productPicker__title">{current.label}</span>
        <ChevronsUpDown size={14} className="productPicker__chevron" aria-hidden />
      </button>

      {open && position ? (
        <div
          id="product-picker-menu"
          ref={popoverRef}
          role="listbox"
          aria-label="Switch product"
          className="productPicker__menu"
          onKeyDown={onMenuKeyDown}
          style={{ top: position.top, bottom: position.bottom, left: position.left, maxHeight: position.maxHeight }}
        >
          {PRODUCTS.map((product) => {
            const isSelected = product.id === selected;
            return (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="productPicker__row"
                onClick={() => {
                  onSelect(product.id);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <ProductLogo product={product.id} size="lg" />
                <span className="productPicker__rowBody">
                  <DsTypography as="span" variant="paragraph-small-bold">
                    {product.label}
                  </DsTypography>
                  <DsTypography as="span" variant="paragraph-mini-regular" className="productPicker__rowMeta">
                    {product.description}
                  </DsTypography>
                </span>
                {isSelected ? <Check size={16} className="productPicker__rowCheck" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
