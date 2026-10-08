/**
 * The products this shell can host. Each one owns its own home screen; the
 * topbar's product picker swaps between them. Settings stays shared — the
 * same AI models and workspace connections back every product.
 */
export type ProductId = "ds-accelerator" | "knowledge-base" | "knowledge-base-v2";

export type ProductMeta = {
  id: ProductId;
  label: string;
  description: string;
};

export const PRODUCTS: readonly ProductMeta[] = [
  {
    id: "ds-accelerator",
    label: "DS Accelerator",
    description: "Improve, test and create design system components",
  },
  {
    id: "knowledge-base",
    label: "Product Knowledge Base v1",
    description: "Ask your product's sources, plan initiatives with evidence",
  },
  {
    id: "knowledge-base-v2",
    label: "Product Knowledge Base v2",
    description: "Agents surface insights and propose initiatives for you to take further",
  },
];

const STORAGE_KEY = "ds-starter:product";

export function productMeta(id: ProductId): ProductMeta {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0]!;
}

export function getInitialProduct(): ProductId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (PRODUCTS.some((p) => p.id === stored)) return stored as ProductId;
  } catch {
    // Storage unavailable (private window, blocked site data) — fall back to the default.
  }
  return "ds-accelerator";
}

export function persistProduct(id: ProductId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Non-critical: the choice just won't survive a reload.
  }
}
