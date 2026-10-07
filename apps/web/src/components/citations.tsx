import { createContext, useContext } from "react";

export interface CitationIndex {
  evidenceIds: ReadonlySet<string>;
  policyIds: ReadonlySet<string>;
  highlighted: string | null;
  focus(id: string): void;
}

export const CitationContext = createContext<CitationIndex>({
  evidenceIds: new Set(),
  policyIds: new Set(),
  highlighted: null,
  focus: () => undefined,
});

export const anchorId = (id: string): string => `ref-${id}`;

/** Evidence or policy reference chip. Unknown IDs render in the "unresolved" warning style. */
export function Chip({ id, kind }: { id: string; kind: "evidence" | "policy" }) {
  const idx = useContext(CitationContext);
  const resolved = kind === "evidence" ? idx.evidenceIds.has(id) : idx.policyIds.has(id);
  return (
    <button
      type="button"
      className={`chip chip-${kind}${resolved ? "" : " chip-unresolved"}`}
      data-unresolved={resolved ? undefined : "true"}
      title={resolved ? `Show ${id}` : `Unresolved citation: ${id} is not in this run's ${kind === "evidence" ? "evidence" : "policy"} list`}
      onClick={() => resolved && idx.focus(id)}
    >
      {resolved ? "" : "⚠ "}
      {id}
    </button>
  );
}

export function Chips({ evidenceIds = [], policyIds = [] }: { evidenceIds?: readonly string[]; policyIds?: readonly string[] }) {
  if (evidenceIds.length === 0 && policyIds.length === 0) return null;
  return (
    <span className="chips">
      {evidenceIds.map((id) => <Chip key={`e-${id}`} id={id} kind="evidence" />)}
      {policyIds.map((id) => <Chip key={`p-${id}`} id={id} kind="policy" />)}
    </span>
  );
}
