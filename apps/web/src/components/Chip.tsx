import { createContext, useContext } from 'react';
import { clauseLabel } from '../lib/present.js';

export interface ChipContextValue {
  knownIds: Set<string>;
  evidenceLabels: Map<string, string>;
}

export const ChipContext = createContext<ChipContextValue>({knownIds: new Set<string>(), evidenceLabels: new Map<string, string>()});

interface ChipProps { id: string; kind: 'evidence' | 'policy' }

/** A cited ID. Known chips scroll to the record card and highlight it for 1.5 s. */
export function Chip({id, kind}: ChipProps) {
  const {knownIds, evidenceLabels} = useContext(ChipContext);
  const known = knownIds.has(id);
  const label = kind === 'evidence' ? evidenceLabels.get(id) ?? id : clauseLabel(id);
  const targetId = `${kind === 'evidence' ? 'ev' : 'pol'}-${id}`;
  const handleClick = (): void => {
    const element = document.getElementById(targetId);
    if (element === null) return;
    let details = element.closest('details');
    while (details !== null) {
      details.open = true;
      const parent = details.parentElement;
      details = parent === null ? null : parent.closest('details');
    }
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    element.classList.add('chip-target');
    window.setTimeout(() => { element.classList.remove('chip-target'); }, 1500);
  };
  return (
    <button
      type="button"
      className={known ? 'chip' : 'chip chip-unresolved'}
      onClick={handleClick}
      title={known ? undefined : 'Not among the retrieved records'}
    >
      <span className="chip-label">{label}</span>
      {label === id ? null : <span className="chip-id">{id}</span>}
      {known ? null : <span className="visually-hidden"> (not among the retrieved records)</span>}
    </button>
  );
}
