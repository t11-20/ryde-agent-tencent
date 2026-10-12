interface ChipProps { id: string; kind: 'evidence' | 'policy'; known: boolean }

/** A cited ID. Known chips scroll to the record card and highlight it for 1.5 s. */
export function Chip({id, kind, known}: ChipProps) {
  const targetId = `${kind === 'evidence' ? 'ev' : 'pol'}-${id}`;
  const unknownAttributes = known ? {} : {title: 'Not among the retrieved records'};
  const handleClick = (): void => {
    const element = document.getElementById(targetId);
    if (element === null) return;
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    element.classList.add('chip-target');
    window.setTimeout(() => { element.classList.remove('chip-target'); }, 1500);
  };
  return (
    <button type="button" className={known ? 'chip' : 'chip chip-unresolved'} onClick={handleClick} {...unknownAttributes}>
      {id}
    </button>
  );
}
