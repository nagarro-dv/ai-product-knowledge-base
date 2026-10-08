import type { KnowledgeSource } from "./sources";
import "./SourceMark.css";

/** A source's brand logo when it has one, otherwise its generic icon — always `size` px square. */
export function SourceMark({ source, size }: { source: KnowledgeSource; size: number }) {
  if (typeof source.mark === "string") {
    return <img src={source.mark} alt="" aria-hidden width={size} height={size} className="sourceMark" />;
  }
  const Icon = source.mark;
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}
